package com.aima.service.Impl;

import com.aima.service.ActivityLogService;
import com.aima.enums.ActivityAction;
import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanFeatureRequest;
import com.aima.dto.request.PlanFeatureValueRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlanFeatureResponse;
import com.aima.dto.response.PlanResponse;
import com.aima.dto.response.PlansResponse;
import com.aima.entity.Plan;
import com.aima.entity.PlanFeature;
import com.aima.entity.PlanFeatureValue;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlanMapper;
import com.aima.repository.PlanFeatureRepository;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.service.EntitlementHoldService;
import com.aima.service.PlatformAvailabilityService;
import com.aima.repository.SubscriptionRepository;
import com.aima.entity.PlanFeatureLimits;
import com.aima.enums.PlanLimitKey;
import com.aima.dto.response.PlanFeatureAutoValueResponse;
import java.util.ArrayList;
import java.util.HashMap;
import com.aima.service.PlanService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanServiceImpl implements PlanService {

    ActivityLogService activityLogService;

    PlanRepository planRepository;
    PlanFeatureRepository featureRepository;
    PlanMapper planMapper;
    PlanLimitService planLimitService;
    SubscriptionRepository subscriptionRepository;
    PlatformAvailabilityService platformAvailabilityService;
    EntitlementHoldService entitlementHoldService;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PlansResponse> getPublic() {
        List<Plan> plans = planRepository.findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();
        PlansResponse result = buildResponse(plans);
        return ApiResponse.success("Danh sách gói công khai", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PlansResponse> list() {
        List<Plan> plans = planRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();
        PlansResponse result = buildResponse(plans);
        Map<UUID, Long> subscriberCounts = new HashMap<>();
        plans.forEach(plan -> subscriberCounts.put(plan.getId(), subscriptionRepository.countByPlan_IdAndDeletedAtIsNull(plan.getId())));
        result.setPlans(planMapper.toResponseList(plans, subscriberCounts));
        result.setLimitDefaults(planMapper.toLimitDefaults(planLimitService.defaultFeatureLimits()));
        return ApiResponse.success("Danh sách gói (admin)", result);
    }

    private PlansResponse buildResponse(List<Plan> plans) {
        List<PlanFeature> features = featureRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();
        return PlansResponse.builder()
                .plans(planMapper.toResponseList(plans))
                .features(planMapper.toFeatureResponseList(features, autoValues(features, plans)))
                .build();
    }

    /**
     * Ô tự động của các dòng so sánh LIÊN KẾT giới hạn: giá trị hiệu lực của từng gói (không nhập tay, không lệch giới hạn
     * thật). ALLOWED_PLATFORMS kèm trạng thái khoá toàn hệ thống — nền tảng khoá hiển thị "Sắp ra mắt".
     */
    private Map<UUID, List<PlanFeatureAutoValueResponse>> autoValues(List<PlanFeature> features, List<Plan> plans) {
        Map<UUID, List<PlanFeatureAutoValueResponse>> result = new HashMap<>();
        if (features.stream().noneMatch(f -> f.getLimitKey() != null)) {
            return result;
        }
        Map<UUID, PlanLimitService.FeatureLimits> limitsByPlan = new HashMap<>();
        plans.forEach(plan -> limitsByPlan.put(plan.getId(), planLimitService.featuresOf(plan)));
        for (PlanFeature feature : features) {
            PlanLimitKey key = feature.getLimitKey();
            if (key == null) {
                continue;
            }
            List<PlanFeatureAutoValueResponse> cells = new ArrayList<>();
            for (Plan plan : plans) {
                cells.add(autoCell(plan.getCode(), key, limitsByPlan.get(plan.getId())));
            }
            result.put(feature.getId(), cells);
        }
        return result;
    }

    private PlanFeatureAutoValueResponse autoCell(String planCode, PlanLimitKey key, PlanLimitService.FeatureLimits limits) {
        if (key.type() == PlanLimitKey.Type.SET) {
            List<PlanFeatureAutoValueResponse.PlatformCell> platforms = limits.allowedPlatforms().stream()
                    .map(p -> planMapper.toPlatformCell(p, !platformAvailabilityService.isEnabled(p)))
                    .toList();
            return planMapper.toAutoValue(planCode, platforms.isEmpty() ? PlanFeatureAutoValueResponse.Kind.OFF
                    : PlanFeatureAutoValueResponse.Kind.PLATFORMS, null, platforms);
        }
        Long value = limits.limit(key);
        PlanFeatureAutoValueResponse.Kind kind;
        if (value != null && value == 0L) {
            kind = PlanFeatureAutoValueResponse.Kind.OFF;
        } else if (key.type() == PlanLimitKey.Type.FLAG) {
            kind = PlanFeatureAutoValueResponse.Kind.ON;
        } else {
            kind = value == null ? PlanFeatureAutoValueResponse.Kind.UNLIMITED : PlanFeatureAutoValueResponse.Kind.NUMBER;
        }
        return planMapper.toAutoValue(planCode, kind, kind == PlanFeatureAutoValueResponse.Kind.NUMBER ? value : null, null);
    }

    @Override
    @Transactional
    public ApiResponse<PlanResponse> create(PlanCreateRequest request) {
        String code = request.getCode().trim().toUpperCase();
        if (planRepository.existsByCodeAndDeletedAtIsNull(code)) {
            throw new AppException(ErrorCode.PLAN_CODE_EXISTED);
        }

        Plan plan = planMapper.toPlan(request);
        plan.setCode(code);
        applyDefaults(plan);
        PlanFeatureLimits limits = new PlanFeatureLimits();
        if (request.getFeatureLimits() != null) {
            planMapper.updateLimits(request.getFeatureLimits(), limits);
        }
        plan.setFeatureLimits(limits);
        requireCompleteLimits(plan);
        requireTokenLimitWhenSellable(plan);
        Plan saved = planRepository.save(plan);

        logPlanConfig("PLAN_CREATED", "Plan", saved.getId().toString(), Map.of("code", saved.getCode()));
        PlanResponse planResponse = planMapper.toResponse(saved);
        return ApiResponse.success("Tạo gói dịch vụ thành công", planResponse);
    }

    // Mapper giữ nguyên null từ request — các cột NOT NULL cần giá trị mặc định an toàn.
    private void applyDefaults(Plan plan) {
        if (plan.getPrice() == null) plan.setPrice(0L);
        if (plan.getHighlight() == null) plan.setHighlight(false);
        if (plan.getDisplayOrder() == null) plan.setDisplayOrder(0);
        if (plan.getIsActive() == null) plan.setIsActive(true);
    }

    /**
     * Ô giới hạn trong request: null = giữ nguyên; {@code resetToDefault} đưa ô về "Mặc định hệ thống" — CHỈ 3 gói lõi
     * (gói tự tạo không có mặc định ngầm, xem {@link #requireCompleteLimits}).
     */
    private void applyLimits(Plan plan, PlanUpdateRequest request) {
        PlanFeatureLimits limits = plan.getFeatureLimits() != null ? plan.getFeatureLimits() : new PlanFeatureLimits();
        if (request.getFeatureLimits() != null) {
            planMapper.updateLimits(request.getFeatureLimits(), limits);
        }
        if (request.getResetToDefault() != null && !request.getResetToDefault().isEmpty()) {
            if (!Plan.CORE_CODES.contains(plan.getCode())) {
                throw new AppException(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED);
            }
            request.getResetToDefault().forEach(key -> key.write(limits, null));
        }
        plan.setFeatureLimits(limits);
    }

    /**
     * Fail-closed: gói TỰ TẠO phải có giá trị cụ thể cho MỌI giới hạn — "Mặc định hệ thống" (mặc định không giới hạn)
     * chỉ dành cho 3 gói lõi, không để gói mới ngầm thành "không giới hạn".
     */
    private static void requireCompleteLimits(Plan plan) {
        if (Plan.CORE_CODES.contains(plan.getCode())) {
            return;
        }
        for (PlanLimitKey key : PlanLimitKey.values()) {
            if (key.rawValue(plan.getFeatureLimits()) == null) {
                throw new AppException(ErrorCode.PLAN_LIMIT_VALUE_REQUIRED);
            }
        }
    }

    /**
     * Gói đang bán (giá > 0 và đang bật — cùng điều kiện PaymentServiceImpl.requirePurchasable)
     * bắt buộc có hạn mức token THẬT: monthlyTokenLimit null = không giới hạn trong
     * TokenUsageService, nên gói admin tạo mà quên hạn mức sẽ thành gói "vô hạn" ngoài ý muốn.
     */
    private void requireTokenLimitWhenSellable(Plan plan) {
        boolean sellable = Boolean.TRUE.equals(plan.getIsActive()) && plan.getPrice() != null && plan.getPrice() > 0;
        if (sellable && plan.getMonthlyTokenLimit() == null) {
            throw new AppException(ErrorCode.PLAN_TOKEN_LIMIT_REQUIRED);
        }
    }

    @Override
    @Transactional
    public ApiResponse<PlanResponse> update(UUID id, PlanUpdateRequest request) {
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        PlanLimitService.FeatureLimits before = planLimitService.featuresOf(plan);
        planMapper.update(request, plan);
        if (request.getMonthlyTokenLimit() != null && request.getMonthlyTokenLimit() == PlanLimitService.UNLIMITED) {
            plan.setMonthlyTokenLimit(null); // -1 = không giới hạn (null = giữ nguyên ở request)
        }
        applyLimits(plan, request);
        requireCompleteLimits(plan);
        requireTokenLimitWhenSellable(plan);
        Plan saved = planRepository.save(plan);
        // Gói bỏ bớt nền tảng / tắt lên lịch → giữ lịch chưa đăng của người đang ở gói (không tự gỡ khi mở lại).
        PlanLimitService.FeatureLimits after = planLimitService.featuresOf(saved);
        if (!after.allowedPlatforms().containsAll(before.allowedPlatforms())
                || (before.included(PlanLimitKey.SCHEDULING) && !after.included(PlanLimitKey.SCHEDULING))) {
            int held = entitlementHoldService.syncPlanSubscribers(saved.getId());
            log.info("[Plan] Gói {} thu hẹp quyền — {} lịch chưa đăng chuyển Tạm giữ", saved.getCode(), held);
        }

        logPlanConfig("PLAN_UPDATED", "Plan", saved.getId().toString(), Map.of("code", saved.getCode()));
        PlanResponse planResponse = planMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật gói dịch vụ thành công", planResponse);
    }

    @Override
    @Transactional
    public ApiResponse<String> delete(UUID id) {
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));
        if (Plan.CORE_CODES.contains(plan.getCode())) {
            throw new AppException(ErrorCode.PLAN_CORE_PROTECTED);
        }

        plan.setDeletedAt(LocalDateTime.now());
        planRepository.save(plan);
        log.info("[Plan] Soft-deleted plan {} ({})", plan.getCode(), id);
        logPlanConfig("PLAN_DELETED", "Plan", id.toString(), Map.of("code", plan.getCode()));
        return ApiResponse.success("Đã xóa gói dịch vụ");
    }

    @Override
    @Transactional
    public ApiResponse<PlanFeatureResponse> createFeature(PlanFeatureRequest request) {
        PlanFeature feature = planMapper.toFeature(request);
        if (feature.getDisplayOrder() == null) feature.setDisplayOrder(0);
        if (feature.getLimitKey() == null) {
            reconcileValues(request, feature); // dòng liên kết giới hạn không lưu ô nhập tay
        }
        PlanFeature saved = featureRepository.save(feature);

        PlanFeatureResponse featureResponse = planMapper.toFeatureResponse(saved);
        return ApiResponse.success("Thêm dòng tính năng thành công", featureResponse);
    }

    @Override
    @Transactional
    public ApiResponse<PlanFeatureResponse> updateFeature(UUID id, PlanFeatureRequest request) {
        PlanFeature feature = featureRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_FEATURE_NOT_FOUND));

        planMapper.update(request, feature);
        if (feature.getDisplayOrder() == null) feature.setDisplayOrder(0);
        if (feature.getLimitKey() == null) {
            reconcileValues(request, feature);
        }
        PlanFeature saved = featureRepository.save(feature);

        PlanFeatureResponse featureResponse = planMapper.toFeatureResponse(saved);
        return ApiResponse.success("Cập nhật dòng tính năng thành công", featureResponse);
    }

    /** Đồng bộ giá trị ô theo mã gói: có sẵn thì cập nhật, chưa có thì thêm (cascade từ feature). */
    private void reconcileValues(PlanFeatureRequest request, PlanFeature feature) {
        if (request.getValues() == null) return;
        for (PlanFeatureValueRequest valueRequest : request.getValues()) {
            String code = valueRequest.getPlanCode().trim().toUpperCase();
            Plan plan = planRepository.findByCodeAndDeletedAtIsNull(code)
                    .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

            Optional<PlanFeatureValue> existing = feature.getValues().stream()
                    .filter(v -> v.getPlan().getId().equals(plan.getId()))
                    .findFirst();
            if (existing.isPresent()) {
                planMapper.updateValue(valueRequest, existing.get());
            } else {
                feature.getValues().add(planMapper.toValue(valueRequest, plan, feature));
            }
        }
    }

    @Override
    @Transactional
    public ApiResponse<String> deleteFeature(UUID id) {
        PlanFeature feature = featureRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_FEATURE_NOT_FOUND));

        feature.setDeletedAt(LocalDateTime.now());
        featureRepository.save(feature);
        log.info("[Plan] Soft-deleted plan feature {}", id);
        logPlanConfig("FEATURE_DELETED", "PlanFeature", id.toString(), Map.of());
        return ApiResponse.success("Đã xóa dòng tính năng");
    }

    /**
     * Các method ở đây không nhận email người thao tác (chữ ký công khai, đổi sẽ lan sang
     * controller) nên lấy actor từ SecurityContext — cùng cách {@code AiConfigServiceImpl}
     * đã làm cho audit cấu hình AI.
     */
    private void logPlanConfig(String operation, String targetType, String targetId,
                               Map<String, Object> extra) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String actorEmail = authentication == null ? null : authentication.getName();
        Map<String, Object> metadata = new LinkedHashMap<>(extra);
        metadata.put("operation", operation);
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.PLAN_CONFIG_UPDATED, actorEmail, targetType, targetId, metadata));
    }
}
