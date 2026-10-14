package com.aima.service.Impl;

import com.aima.util.NotificationParams;
import com.aima.service.RealtimeEventPublisher;
import com.aima.service.NotificationService;
import com.aima.enums.RealtimeEventType;
import com.aima.enums.NotificationType;
import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TokenUsageResponse;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.UsageAdjustment;
import com.aima.entity.User;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.UsageAdjustmentType;
import com.aima.enums.UserPlan;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentRegenerationJobRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.UsageAdjustmentRepository;
import com.aima.repository.UserRepository;
import com.aima.service.SubscriptionService;
import com.aima.service.TokenCreditService;
import com.aima.service.TokenUsageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TokenUsageServiceImpl implements TokenUsageService {

    /** Ngưỡng cảnh báo hạn mức (D7: 80% / 100%). */
    static final int QUOTA_WARNING_PERCENT = 80;

    UserRepository userRepository;
    PlanRepository planRepository;
    SubscriptionService subscriptionService;
    AiUsageRepository aiUsageRepository;
    UsageAdjustmentRepository usageAdjustmentRepository;
    TokenCreditService tokenCreditService;
    UserMapper userMapper;
    ContentGenerationJobRepository generationJobRepository;
    ContentFormattingJobRepository formattingJobRepository;
    ContentRegenerationJobRepository regenerationJobRepository;
    NotificationService notificationService;
    RealtimeEventPublisher realtimeEventPublisher;

    private static final List<GenerationJobStatus> IN_FLIGHT =
            List.of(GenerationJobStatus.PENDING, GenerationJobStatus.RUNNING);

    @Override
    @Transactional // không readOnly: getOrCreate có thể tạo subscription / lăn kỳ
    public ApiResponse<TokenUsageResponse> getMyUsage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        QuotaState state = state(user);
        // Gói đang áp hạn mức + mốc đổi gói chờ (hạ gói giữa kỳ hiệu lực từ kỳ sau) — UI hiển thị
        // "Plus (áp dụng từ 01/08)" mà không phải tự suy luận từ hai nguồn.
        Subscription subscription = subscriptionService.getOrCreate(user);
        String effectivePlan = subscription == null ? null : subscription.getPlan().getCode();
        LocalDateTime pendingChangeAt = pendingPlanChangeAt(user, subscription);
        TokenUsageResponse response = userMapper.toTokenUsageResponse(
                user, state.used(), state.limit(), state.creditLeft(), effectivePlan, pendingChangeAt);
        return ApiResponse.success("Lấy mức dùng token thành công", response);
    }

    /** Mốc gói mới bắt đầu áp dụng (= cuối kỳ) khi nhãn User.plan khác gói subscription. */
    public static LocalDateTime pendingPlanChangeAt(User user, Subscription subscription) {
        if (subscription == null) {
            return null;
        }
        String labelCode = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();
        return labelCode.equals(subscription.getPlan().getCode()) ? null : subscription.getCurrentPeriodEnd();
    }

    @Override
    public QuotaState state(User user) {
        Subscription subscription = subscriptionService.getOrCreate(user);
        LocalDateTime start;
        LocalDateTime end;
        Long limit;
        if (subscription != null) {
            start = subscription.getCurrentPeriodStart();
            end = subscription.getCurrentPeriodEnd();
            limit = subscription.getPlan().getMonthlyTokenLimit();
        } else {
            // DB chưa seed gói của user — rơi về tháng lịch + hạn mức tra theo User.plan.
            YearMonth month = YearMonth.now();
            start = month.atDay(1).atStartOfDay();
            end = month.plusMonths(1).atDay(1).atStartOfDay();
            limit = resolveLimit(user);
        }

        // Mốc RESET gần nhất trong kỳ: mức dùng chỉ tính các event SAU mốc đó.
        LocalDateTime from = usageAdjustmentRepository
                .findByUserAndTypeInWindow(user.getId(), UsageAdjustmentType.RESET, start, end)
                .stream().findFirst()
                .map(UsageAdjustment::getCreatedAt)
                .filter(reset -> reset.isAfter(start))
                .orElse(start);

        long raw = aiUsageRepository.sumTokensForUser(user.getId(), from, end); // đã trừ credit_units
        long granted = usageAdjustmentRepository.sumGrantedForUser(user.getId(), from, end);
        long creditLeft = tokenCreditService.creditLeft(user.getId());
        return new QuotaState(Math.max(0, raw - granted), limit, creditLeft);
    }

    @Override
    public QuotaState checkQuota(User user) {
        QuotaState state = state(user);
        if (state.exceeded()) {
            throw new AppException(ErrorCode.TOKEN_QUOTA_EXCEEDED);
        }
        return state;
    }

    @Override
    public void checkConcurrentAiJobs(User user) {
        UUID userId = user.getId();
        long inFlight = generationJobRepository.countByContentStrategy_BrandProfile_User_IdAndStatusInAndDeletedAtIsNull(userId, IN_FLIGHT)
                + formattingJobRepository.countByContentItem_BrandProfile_User_IdAndStatusInAndDeletedAtIsNull(userId, IN_FLIGHT)
                + regenerationJobRepository.countByContentVersion_ContentItem_BrandProfile_User_IdAndStatusInAndDeletedAtIsNull(userId, IN_FLIGHT);
        if (inFlight >= MAX_CONCURRENT_AI_JOBS) {
            log.info("[TokenUsage] User {} đã có {} tác vụ AI đang chạy — chặn tác vụ mới", userId, inFlight);
            throw new AppException(ErrorCode.AI_JOBS_LIMIT_REACHED);
        }
    }

    @Override
    public void record(User user, Long tokens) {
        // Chỉ còn nuôi CACHE users.tokens_used (đối soát nhanh / dựng lại qua reconcile) —
        // nguồn hiển thị & enforcement là event log ai_usage. Từ pha 2 gọi từ
        // AiUsageServiceImpl.saveEvent với lượng billable − credit (KHÔNG phải token thô)
        // để cache không lệch khi admin đặt hệ số quy đổi ≠ 1.
        long amount = tokens == null ? 0L : tokens;
        if (amount <= 0) {
            return;
        }
        // Reset lazy: sang tháng mới thì mức dùng bắt đầu lại từ 0.
        String month = currentMonth();
        long base = month.equals(user.getTokenUsageMonth())
                ? (user.getTokensUsed() == null ? 0L : user.getTokensUsed())
                : 0L;
        user.setTokenUsageMonth(month);
        user.setTokensUsed(base + amount);
        userRepository.save(user);
    }

    @Override
    public void notifyQuotaThresholds(UUID userId) {
        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                return;
            }
            QuotaState state = state(user);
            if (state.limit() == null || state.limit() <= 0) {
                return; // gói không giới hạn
            }
            int percent = (int) Math.min(999, state.used() * 100 / state.limit());
            realtimeEventPublisher.toUser(userId, RealtimeEventType.USAGE_UPDATED, NotificationParams.of("percent", percent));
            if (percent < QUOTA_WARNING_PERCENT) {
                return;
            }
            Subscription subscription = subscriptionService.getOrCreate(user);
            String period = subscription == null || subscription.getCurrentPeriodStart() == null
                    ? currentMonth() : subscription.getCurrentPeriodStart().toLocalDate().toString();
            boolean exhausted = percent >= 100;
            String creditNote = state.creditLeft() > 0 ? " AIMA đang dùng token bạn đã mua thêm." : "";
            notificationService.send(user, NotificationDraft.builder()
                    .type(exhausted ? NotificationType.AI_QUOTA_EXHAUSTED : NotificationType.AI_QUOTA_WARNING)
                    .title(exhausted ? "Đã dùng hết hạn mức token" : "Sắp hết hạn mức token")
                    .message((exhausted ? "Bạn đã dùng hết hạn mức token AI của kỳ này." : "Bạn đã dùng " + percent
                            + "% hạn mức token AI của kỳ này.") + creditNote + " Nâng cấp gói hoặc mua thêm token để tiếp tục.")
                    .params(NotificationParams.of("percent", percent, "creditLeft", state.creditLeft(), "period", period))
                    .dedupeKey("quota:" + userId + ":" + period + ":" + (exhausted ? 100 : QUOTA_WARNING_PERCENT))
                    .build());
        } catch (Exception e) {
            log.warn("[TokenUsage] Không báo được ngưỡng hạn mức cho user {}: {}", userId, e.toString());
        }
    }

    // Hạn mức lấy từ row Plan theo code = user.plan (3 gói lõi khớp enum UserPlan).
    // Thiếu row (DB chưa seed) → null = không chặn, chỉ log để không khóa nhầm user.
    private Long resolveLimit(User user) {
        String code = user.getPlan() == null ? UserPlan.FREE.name() : user.getPlan().name();
        return planRepository.findByCodeAndDeletedAtIsNull(code)
                .map(Plan::getMonthlyTokenLimit)
                .orElseGet(() -> {
                    log.warn("[TokenUsage] Không tìm thấy gói {} — bỏ qua hạn mức token", code);
                    return null;
                });
    }

    private static String currentMonth() {
        return YearMonth.now().toString(); // "2026-07"
    }
}
