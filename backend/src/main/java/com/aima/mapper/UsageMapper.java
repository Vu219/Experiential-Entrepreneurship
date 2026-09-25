package com.aima.mapper;

import com.aima.dto.request.BillingRateRequest;
import com.aima.dto.response.AiUsageByTaskResponse;
import com.aima.dto.response.AlertRuleStatResponse;
import com.aima.dto.response.UsageAlertResponse;
import com.aima.dto.response.BillingRateResponse;
import com.aima.dto.response.HeatmapPointResponse;
import com.aima.dto.response.PlanUsageResponse;
import com.aima.dto.response.UsageModelStatResponse;
import com.aima.dto.response.UsageOverviewResponse;
import com.aima.dto.response.UsageTaskStatResponse;
import com.aima.dto.response.UsageTopUserResponse;
import com.aima.dto.response.UsageAdjustmentResponse;
import com.aima.dto.response.UsageSeriesPointResponse;
import com.aima.dto.response.TokenCreditResponse;
import com.aima.dto.response.UsageEventMetaResponse;
import com.aima.dto.response.UsageEventResponse;
import com.aima.dto.response.UserSessionsResponse;
import com.aima.dto.response.UserUsageDetailResponse;
import com.aima.dto.response.UserUsageResponse;
import com.aima.dto.response.UserUsageRowResponse;
import com.aima.entity.AiUsage;
import com.aima.entity.BillingRate;
import com.aima.entity.TokenCredit;
import com.aima.entity.UsageAlert;
import com.aima.entity.Plan;
import com.aima.dto.response.SubscriptionHistoryResponse;
import com.aima.dto.response.UserSubscriptionResponse;
import com.aima.entity.Subscription;
import com.aima.entity.SubscriptionHistory;
import com.aima.entity.UsageAdjustment;
import com.aima.entity.User;
import com.aima.enums.DurationUnit;
import com.aima.enums.SubscriptionHistoryAction;
import com.aima.enums.SubscriptionStatus;
import com.aima.enums.UsageAdjustmentSource;
import com.aima.enums.UsageAdjustmentType;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.UsageAlertRepository;
import com.aima.repository.UsageHourlyRepository;
import com.aima.service.SubscriptionService;
import com.aima.service.TokenUsageService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Mapper(componentModel = "spring")
public interface UsageMapper {
    @Mapping(target = "user", source = "userEntity")
    @Mapping(target = "plan", source = "planEntity")
    @Mapping(target = "status", source = "subStatus")
    Subscription toSubscription(User userEntity, Plan planEntity, SubscriptionStatus subStatus,
                                LocalDateTime currentPeriodStart, LocalDateTime currentPeriodEnd);

    // ===== Lịch sử gói (subscription_history) + gói của một user cho admin =====

    /**
     * Một dòng lịch sử: vế "from" từ snapshot trước khi đổi, vế "to" từ subscription sau khi đổi.
     * {@code change} null = sự kiện hệ thống → actor/category/reason null. Mapper đi qua builder
     * (không lộ field BaseEntity) nên id/audit field của {@code after} không bị chép sang.
     */
    @Mapping(target = "fromPlanCode", source = "before.planCode")
    @Mapping(target = "fromExpiresAt", source = "before.expiresAt")
    @Mapping(target = "fromSource", source = "before.source")
    @Mapping(target = "toPlanCode", source = "after.plan.code")
    @Mapping(target = "toExpiresAt", source = "after.planExpiresAt")
    @Mapping(target = "toSource", source = "after.planSource")
    @Mapping(target = "actorUserId", source = "change.actorId")
    @Mapping(target = "actorEmail", source = "change.actorEmail")
    @Mapping(target = "category", source = "change.category")
    @Mapping(target = "reason", source = "change.reason")
    SubscriptionHistory toSubscriptionHistory(SubscriptionHistoryAction action,
                                              SubscriptionService.PlanSnapshot before, Subscription after,
                                              SubscriptionService.AdminChange change,
                                              Integer extendAmount, DurationUnit extendUnit);

    SubscriptionHistoryResponse toSubscriptionHistoryResponse(SubscriptionHistory history);

    List<SubscriptionHistoryResponse> toSubscriptionHistoryResponseList(List<SubscriptionHistory> histories);

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    @Mapping(target = "planLabel", source = "user.plan")
    UserSubscriptionResponse toUserSubscriptionResponse(Subscription subscription);

    @Mapping(target = "day", source = "dayOfMonth")
    UsageSeriesPointResponse toSeriesPoint(AiUsageRepository.DailyUsageAgg agg);

    List<UsageSeriesPointResponse> toSeriesPointList(List<AiUsageRepository.DailyUsageAgg> aggs);

    /** plan có thể null (DB chưa seed gói) → các trường plan* null, FE tự fallback. */
    @Mapping(target = "used", source = "quota.used")
    @Mapping(target = "limit", source = "quota.limit")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    @Mapping(target = "planPrice", source = "plan.price")
    UserUsageResponse toUsageResponse(String billingPeriod, LocalDateTime periodStart, LocalDateTime periodEnd,
                                      TokenUsageService.QuotaState quota, Plan plan,
                                      String effectivePlanForQuota, LocalDateTime pendingPlanChangeAt,
                                      Long creditUsed,
                                      List<UsageSeriesPointResponse> series,
                                      List<AiUsageByTaskResponse> byFeature);

    // ===== Admin per-plan / per-user =====

    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    PlanUsageResponse toPlanUsage(Plan plan, Long userCount, Long totalTokens, BigDecimal estimatedCost);

    @Mapping(target = "userId", source = "subscription.user.id")
    @Mapping(target = "email", source = "subscription.user.email")
    @Mapping(target = "fullName", source = "subscription.user.fullName")
    @Mapping(target = "avatarUrl", source = "subscription.user.avatarUrl")
    @Mapping(target = "planCode", source = "subscription.plan.code")
    @Mapping(target = "limit", source = "subscription.plan.monthlyTokenLimit")
    UserUsageRowResponse toUserRow(Subscription subscription, Long used);

    @Mapping(target = "actorEmail", source = "actor.email")
    UsageAdjustmentResponse toAdjustmentResponse(UsageAdjustment adjustment);

    List<UsageAdjustmentResponse> toAdjustmentResponseList(List<UsageAdjustment> adjustments);

    @Mapping(target = "userId", source = "user.id")
    UserUsageDetailResponse toUserDetail(User user, UserUsageResponse usage, Long creditShortfall,
                                         List<UsageAdjustmentResponse> adjustments);

    /**
     * Tạo bản ghi điều chỉnh (grant/reset — actor là admin thao tác). Cùng ghi chú builder
     * như {@link #toSubscription}: id/audit field do JPA sinh khi save.
     */
    UsageAdjustment toAdjustment(User user, User actor, UsageAdjustmentType type, UsageAdjustmentSource source,
                                 Long deltaTokens, String reason, String billingPeriod);

    // ===== Billing rates (hệ số quy đổi hạn mức) =====

    /**
     * Version mới từ request: effectiveFrom do service chốt (param {@code from}), effectiveTo
     * mở (null); id/audit field do JPA sinh khi save (builder không lộ field của BaseEntity).
     */
    @Mapping(target = "effectiveFrom", source = "from")
    @Mapping(target = "effectiveTo", ignore = true)
    BillingRate toBillingRate(BillingRateRequest request, LocalDateTime from, User createdBy);

    @Mapping(target = "createdByEmail", source = "createdBy.email")
    BillingRateResponse toBillingRateResponse(BillingRate rate);

    List<BillingRateResponse> toBillingRateResponseList(List<BillingRate> rates);

    // ===== Token credits (bucket token mua thêm) =====

    /** Một dòng credit mới — id/audit/tokensConsumed(=0)/status(=ACTIVE) do entity default + JPA. */
    @Mapping(target = "status", ignore = true) // giữ default ACTIVE — tránh MapStruct nhầm user.status
    TokenCredit toCredit(User user, Long tokensGranted, LocalDateTime expiresAt, String note);

    TokenCreditResponse toCreditResponse(TokenCredit credit);

    List<TokenCreditResponse> toCreditResponseList(List<TokenCredit> credits);

    // ===== Tab Tổng quan (gộp từ rollup usage_hourly) =====

    UsageTaskStatResponse toTaskStat(UsageHourlyRepository.TaskAgg agg);

    List<UsageTaskStatResponse> toTaskStatList(List<UsageHourlyRepository.TaskAgg> aggs);

    UsageModelStatResponse toModelStat(UsageHourlyRepository.ModelAgg agg);

    List<UsageModelStatResponse> toModelStatList(List<UsageHourlyRepository.ModelAgg> aggs);

    @Mapping(target = "userId", source = "user.id")
    UsageTopUserResponse toTopUser(User user, Long totalTokens, BigDecimal costUsd);

    @Mapping(target = "bucket", source = "point.hourBucket")
    HeatmapPointResponse toHeatPoint(UsageHourlyRepository.HeatPoint point, Long latencyAvgMs);

    /** totals (bean) đổ requests/errors/totalTokens/billableUnits/creditUnits/costUsd theo tên. */
    UsageOverviewResponse toOverview(LocalDateTime periodStart, LocalDateTime periodEnd,
                                     UsageHourlyRepository.TotalsAgg totals,
                                     Long prevTotalTokens, Long tokenDeltaPct,
                                     List<UsageTaskStatResponse> topFeatures,
                                     List<UsageModelStatResponse> topModels,
                                     List<UsageTopUserResponse> topUsers);

    // ===== Tab Nhật ký sử dụng (event ai_usage) =====

    /** Row cũ status null = SUCCESS (quy ước coalesce ở tầng đọc, không backfill). */
    @Mapping(target = "userEmail", source = "user.email")
    @Mapping(target = "userFullName", source = "user.fullName")
    @Mapping(target = "status",
            expression = "java(usage.getStatus() == null ? com.aima.enums.AiUsageStatus.SUCCESS : usage.getStatus())")
    UsageEventResponse toEventResponse(AiUsage usage);

    List<UsageEventResponse> toEventResponseList(List<AiUsage> usages);

    UsageEventMetaResponse toEventMeta(AiUsage usage);

    UserSessionsResponse.SessionRow toSessionRow(AiUsageRepository.ClientAgg agg);

    List<UserSessionsResponse.SessionRow> toSessionRowList(List<AiUsageRepository.ClientAgg> aggs);

    // ===== Cảnh báo bất thường (usage_alerts — pha 5A) =====

    UsageAlertResponse toAlertResponse(UsageAlert alert);

    AlertRuleStatResponse toRuleStat(UsageAlertRepository.RuleStatAgg agg, Long falsePositivePct);
}
