package com.aima.service.Impl;

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
import com.aima.service.PlanService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanServiceImpl implements PlanService {

    PlanRepository planRepository;
    PlanFeatureRepository featureRepository;
    PlanMapper planMapper;

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
        return ApiResponse.success("Danh sách gói (admin)", result);
    }

    private PlansResponse buildResponse(List<Plan> plans) {
        List<PlanFeature> features = featureRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();
        return PlansResponse.builder()
                .plans(planMapper.toResponseList(plans))
                .features(planMapper.toFeatureResponseList(features))
                .build();
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
        Plan saved = planRepository.save(plan);

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

    @Override
    @Transactional
    public ApiResponse<PlanResponse> update(UUID id, PlanUpdateRequest request) {
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        planMapper.update(request, plan);
        Plan saved = planRepository.save(plan);

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
        return ApiResponse.success("Đã xóa gói dịch vụ");
    }

    @Override
    @Transactional
    public ApiResponse<PlanFeatureResponse> createFeature(PlanFeatureRequest request) {
        PlanFeature feature = planMapper.toFeature(request);
        if (feature.getDisplayOrder() == null) feature.setDisplayOrder(0);
        reconcileValues(request, feature);
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
        reconcileValues(request, feature);
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
        return ApiResponse.success("Đã xóa dòng tính năng");
    }
}
