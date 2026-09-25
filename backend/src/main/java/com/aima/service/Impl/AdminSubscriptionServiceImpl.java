package com.aima.service.Impl;

import com.aima.dto.request.SubscriptionChangeRequest;
import com.aima.dto.request.SubscriptionExtendRequest;
import com.aima.dto.request.SubscriptionRevokeRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SubscriptionHistoryResponse;
import com.aima.dto.response.UserSubscriptionResponse;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.SubscriptionHistory;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionHistoryRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.AdminSubscriptionService;
import com.aima.service.SubscriptionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AdminSubscriptionServiceImpl implements AdminSubscriptionService {

    static final String TARGET_SUBSCRIPTION = "SUBSCRIPTION";
    static final int MAX_PAGE_SIZE = 50;

    UserRepository userRepository;
    PlanRepository planRepository;
    SubscriptionRepository subscriptionRepository;
    SubscriptionHistoryRepository subscriptionHistoryRepository;
    SubscriptionService subscriptionService;
    UsageMapper usageMapper;
    ActivityLogService activityLogService;

    // Ghi được: getOrCreate có thể tạo subscription hoặc hạ gói đã hết hạn ngay lúc đọc.
    @Override
    @Transactional
    public ApiResponse<UserSubscriptionResponse> get(UUID userId) {
        User user = requireUser(userId);
        Subscription subscription = subscriptionService.getOrCreate(user);
        if (subscription == null) {
            throw new AppException(ErrorCode.SUBSCRIPTION_NOT_FOUND);
        }
        UserSubscriptionResponse response = usageMapper.toUserSubscriptionResponse(subscription);
        return ApiResponse.success("Lấy gói dịch vụ của người dùng thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<SubscriptionHistoryResponse>> listHistory(UUID userId, int page, int size) {
        requireUser(userId);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<SubscriptionHistory> histories =
                subscriptionHistoryRepository.findByUser_IdOrderByCreatedAtDesc(userId, pageable);
        List<SubscriptionHistoryResponse> content =
                usageMapper.toSubscriptionHistoryResponseList(histories.getContent());
        PageResponse<SubscriptionHistoryResponse> result = PageResponse.from(histories, content);
        return ApiResponse.success("Lấy lịch sử gói thành công", result);
    }

    @Override
    @Transactional
    public ApiResponse<UserSubscriptionResponse> extend(String actorEmail, UUID userId,
                                                        SubscriptionExtendRequest request) {
        User user = lockUser(userId);
        SubscriptionService.AdminChange change = change(actorEmail, request.getCategory(), request.getReason());
        Subscription subscription = subscriptionService.extendPlan(user, request.getAmount(), request.getUnit(),
                LocalDateTime.now(), change);

        audit("EXTEND", user, subscription, change, Map.of(
                "amount", request.getAmount(), "unit", request.getUnit().name()));
        UserSubscriptionResponse response = usageMapper.toUserSubscriptionResponse(subscription);
        return ApiResponse.success("Đã gia hạn gói dịch vụ", response);
    }

    @Override
    @Transactional
    public ApiResponse<UserSubscriptionResponse> change(String actorEmail, UUID userId,
                                                        SubscriptionChangeRequest request) {
        // noExpiry = true → bỏ qua amount/unit; ngược lại bắt buộc có cả hai (trần kiểm ở service).
        if (!request.isNoExpiry() && (request.getAmount() == null || request.getUnit() == null)) {
            throw new AppException(ErrorCode.SUBSCRIPTION_DURATION_INVALID);
        }
        User user = lockUser(userId);
        Plan plan = planRepository.findByIdAndDeletedAtIsNull(request.getPlanId())
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));
        SubscriptionService.AdminChange change = change(actorEmail, request.getCategory(), request.getReason());
        Subscription subscription = subscriptionService.changePlan(user, plan,
                request.isNoExpiry() ? null : request.getAmount(),
                request.isNoExpiry() ? null : request.getUnit(),
                LocalDateTime.now(), change);

        audit("CHANGE", user, subscription, change, Map.of());
        UserSubscriptionResponse response = usageMapper.toUserSubscriptionResponse(subscription);
        return ApiResponse.success("Đã đổi gói dịch vụ", response);
    }

    @Override
    @Transactional
    public ApiResponse<UserSubscriptionResponse> revoke(String actorEmail, UUID userId,
                                                        SubscriptionRevokeRequest request) {
        User user = lockUser(userId);
        SubscriptionService.AdminChange change = change(actorEmail, request.getCategory(), request.getReason());
        Subscription subscription = subscriptionService.revokeToFree(user, LocalDateTime.now(), change);

        audit("REVOKE", user, subscription, change, Map.of());
        UserSubscriptionResponse response = usageMapper.toUserSubscriptionResponse(subscription);
        return ApiResponse.success("Đã thu hồi gói, người dùng về gói Free", response);
    }

    // ================================================================== tiện ích

    private User requireUser(UUID userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    /**
     * Khoá dòng subscription TRƯỚC khi {@code getOrCreate} đọc nó, để entity trong context là
     * bản đã khoá: hai lần bấm gia hạn gần nhau chạy nối tiếp, lần sau cộng trên hạn MỚI chứ
     * không cộng hai lần trên cùng hạn cũ. User chưa có subscription thì không có gì để khoá —
     * getOrCreate sẽ tạo mới.
     */
    private User lockUser(UUID userId) {
        User user = requireUser(userId);
        subscriptionRepository.findForUpdateByUserId(userId);
        return user;
    }

    private SubscriptionService.AdminChange change(String actorEmail, SubscriptionChangeCategory category,
                                                   String reason) {
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        return new SubscriptionService.AdminChange(actor.getId(), actor.getEmail(), category, reason.trim());
    }

    /**
     * Vết trên trang Nhật ký hoạt động của admin (bất đồng bộ, best-effort). Nguồn audit chính
     * là {@code subscription_history} — dòng này chỉ để thao tác hiện cùng các thao tác admin khác.
     */
    private void audit(String operation, User user, Subscription subscription,
                       SubscriptionService.AdminChange change, Map<String, Object> extra) {
        Map<String, Object> metadata = new HashMap<>(extra);
        metadata.put("operation", operation);
        metadata.put("category", change.category().name());
        metadata.put("reason", change.reason());
        metadata.put("plan", subscription.getPlan().getCode());
        metadata.put("expiresAt", subscription.getPlanExpiresAt() == null
                ? "" : subscription.getPlanExpiresAt().toString());
        metadata.put("targetUserEmail", user.getEmail());
        activityLogService.record(ActivityLogService.Entry.byActor(ActivityAction.SUBSCRIPTION_ADJUSTED,
                change.actorEmail(), TARGET_SUBSCRIPTION, user.getId().toString(), metadata));
    }
}
