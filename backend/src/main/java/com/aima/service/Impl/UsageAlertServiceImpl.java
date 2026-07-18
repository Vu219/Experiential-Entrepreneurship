package com.aima.service.Impl;

import com.aima.dto.request.AckAlertRequest;
import com.aima.dto.response.AlertRuleStatResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.UsageAlertResponse;
import com.aima.entity.Subscription;
import com.aima.entity.UsageAlert;
import com.aima.entity.User;
import com.aima.enums.UsageAlertRule;
import com.aima.enums.UsageAlertSeverity;
import com.aima.enums.UsageAlertStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UsageAdjustmentRepository;
import com.aima.repository.UsageAlertRepository;
import com.aima.repository.UsageDailyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.SystemLogService;
import com.aima.service.UsageAlertService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UsageAlertServiceImpl implements UsageAlertService {

    static final int MAX_LIST = 50;

    /**
     * Ngưỡng mặc định — bị PHỦ bởi giá trị cùng key trong bảng {@code system_config}
     * (admin chỉnh qua PUT /admin/usage/alert-config, không cần deploy). Cũng là WHITELIST
     * key hợp lệ. Mọi giá trị là số (long/decimal dạng chuỗi).
     */
    static final Map<String, String> DEFAULTS = Map.ofEntries(
            Map.entry("alert.cooldown-hours", "6"),
            Map.entry("alert.r1.jobs-per-minute", "10"),
            Map.entry("alert.r2.pct-of-limit", "50"),
            Map.entry("alert.r2.min-limit", "100000"),
            Map.entry("alert.r2.floor-tokens", "20000"),
            Map.entry("alert.r3.ratio", "5"),
            Map.entry("alert.r3.min-avg", "2000"),
            Map.entry("alert.r3.min-active-days", "3"),
            Map.entry("alert.r4.min-ips", "5"),
            Map.entry("alert.r4.min-uas", "3"),
            Map.entry("alert.r5.error-pct", "30"),
            Map.entry("alert.r5.min-requests", "20"),
            Map.entry("alert.r6.user-cost-usd", "5"),
            Map.entry("alert.r8.grant-tokens-24h", "500000"),
            Map.entry("alert.r8.grant-count-24h", "10"),
            Map.entry("alert.r8.reset-count-24h", "5"),
            Map.entry("alert.r9.system-cost-usd", "50"));

    /** Cửa sổ quét của scheduler (khớp fixedDelay UsageAlertJob) — R1 quy đổi ngưỡng/phút ra cửa sổ. */
    static final int SCAN_WINDOW_MINUTES = 5;

    UsageAlertRepository alertRepository;
    AiUsageRepository aiUsageRepository;
    UsageDailyRepository usageDailyRepository;
    UsageAdjustmentRepository usageAdjustmentRepository;
    SubscriptionRepository subscriptionRepository;
    UserRepository userRepository;
    SystemLogService systemLogService;
    UsageMapper usageMapper;
    JdbcTemplate jdbcTemplate;

    @NonFinal
    volatile Map<String, String> cachedConfig;

    @NonFinal
    volatile Instant configCachedAt;

    // ===== API admin =====

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<UsageAlertResponse>> list(String viewerEmail, UsageAlertStatus status, UUID userId) {
        UsageAlertStatus effective = status == null ? UsageAlertStatus.OPEN : status;
        List<UsageAlert> alerts = userId != null
                ? alertRepository.findByUserIdAndStatusAndDeletedAtIsNullOrderByLastSeenDesc(userId, effective)
                : alertRepository.findByStatusAndDeletedAtIsNullOrderByLastSeenDesc(effective, PageRequest.of(0, MAX_LIST));
        // R8 giám sát admin: KHÔNG hiển thị cho chính admin bị giám sát (đối tượng alert = admin đó).
        List<UsageAlertResponse> result = alerts.stream()
                .filter(a -> a.getRuleCode() != UsageAlertRule.ADMIN_GRANT_ANOMALY
                        || a.getUserEmail() == null || !a.getUserEmail().equalsIgnoreCase(viewerEmail))
                .map(usageMapper::toAlertResponse)
                .toList();
        return ApiResponse.success("Lấy danh sách cảnh báo thành công", result);
    }

    @Override
    @Transactional
    public ApiResponse<UsageAlertResponse> ack(String actorEmail, UUID alertId, AckAlertRequest request) {
        UsageAlert alert = alertRepository.findById(alertId)
                .filter(a -> a.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USAGE_ALERT_NOT_FOUND));
        if (alert.getStatus() == UsageAlertStatus.ACKED) {
            throw new AppException(ErrorCode.USAGE_ALERT_ALREADY_ACKED);
        }
        boolean falsePositive = request != null && Boolean.TRUE.equals(request.getFalsePositive());
        alert.setStatus(UsageAlertStatus.ACKED);
        alert.setFalsePositive(falsePositive);
        alert.setAckedByEmail(actorEmail);
        alert.setAckedAt(LocalDateTime.now());
        alert.setCooldownUntil(LocalDateTime.now().plusHours(longConfig("alert.cooldown-hours")));
        UsageAlert saved = alertRepository.save(alert);

        systemLogService.info("admin.usage.alerts",
                "ACK cảnh báo " + alert.getRuleCode() + ": actor=" + actorEmail
                        + ", alertId=" + alertId + ", subject=" + (alert.getUserEmail() == null ? "(hệ thống)" : alert.getUserEmail())
                        + ", falsePositive=" + falsePositive);
        UsageAlertResponse response = usageMapper.toAlertResponse(saved);
        return ApiResponse.success("Đã xác nhận cảnh báo", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<AlertRuleStatResponse>> stats() {
        List<AlertRuleStatResponse> stats = alertRepository.statsByRule().stream()
                .map(agg -> usageMapper.toRuleStat(agg,
                        agg.getTotal() == null || agg.getTotal() == 0 ? null
                                : Math.round(nullToZero(agg.getFalsePositives()) * 100.0 / agg.getTotal())))
                .toList();
        return ApiResponse.success("Lấy thống kê báo nhầm theo rule thành công", stats);
    }

    @Override
    public ApiResponse<Map<String, String>> getConfig() {
        return ApiResponse.success("Lấy ngưỡng cảnh báo thành công", new LinkedHashMap<>(effectiveConfig()));
    }

    @Override
    @Transactional
    public ApiResponse<Map<String, String>> updateConfig(String actorEmail, Map<String, String> changes) {
        for (Map.Entry<String, String> entry : changes.entrySet()) {
            if (!DEFAULTS.containsKey(entry.getKey())) {
                throw new AppException(ErrorCode.ALERT_CONFIG_KEY_INVALID);
            }
            try {
                if (new BigDecimal(entry.getValue().trim()).signum() < 0) {
                    throw new AppException(ErrorCode.ALERT_CONFIG_VALUE_INVALID);
                }
            } catch (NumberFormatException e) {
                throw new AppException(ErrorCode.ALERT_CONFIG_VALUE_INVALID);
            }
            jdbcTemplate.update("""
                    INSERT INTO system_config (config_key, config_value) VALUES (?, ?)
                    ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = now()
                    """, entry.getKey(), entry.getValue().trim());
        }
        invalidateConfigCache();
        systemLogService.info("admin.usage.alerts",
                "Đổi ngưỡng cảnh báo: actor=" + actorEmail + ", changes=" + changes);
        return ApiResponse.success("Đã cập nhật ngưỡng cảnh báo", new LinkedHashMap<>(effectiveConfig()));
    }

    // ===== Detection (scheduler gọi 5 phút/lượt) =====

    @Override
    @Transactional
    public void runDetection() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime midnight = LocalDate.now().atStartOfDay();
        // Mỗi rule một try/catch — rule hỏng không phá cả lượt quét (cùng nguyên tắc scheduler khác).
        runRule("R1", () -> detectRequestRate(now));
        runRule("R2", () -> detectQuotaBurst(now));
        runRule("R3", () -> detectDailySpike(midnight));
        runRule("R4", () -> detectMultiClient(now));
        runRule("R5", () -> detectSystemErrorRate(now));
        runRule("R6", () -> detectUserCost(midnight));
        runRule("R7", () -> detectShortfall(now));
        runRule("R8", () -> detectAdminAnomaly(now));
        runRule("R9", () -> detectSystemCost(midnight));
    }

    private void runRule(String label, Runnable rule) {
        try {
            rule.run();
        } catch (Exception e) {
            log.error("[UsageAlert] Rule {} lỗi: {}", label, e.getMessage());
        }
    }

    /** R1 — job AI/phút; ngưỡng/phút × cửa sổ quét. */
    private void detectRequestRate(LocalDateTime now) {
        long threshold = longConfig("alert.r1.jobs-per-minute") * SCAN_WINDOW_MINUTES;
        if (threshold <= 0) {
            return; // ngưỡng 0 = tắt rule
        }
        for (AiUsageRepository.UserActivityAgg agg : aiUsageRepository.activitySince(now.minusMinutes(SCAN_WINDOW_MINUTES))) {
            long requests = nullToZero(agg.getRequests());
            if (requests >= threshold) {
                raise(UsageAlertRule.HIGH_REQUEST_RATE, UsageAlertSeverity.WARNING, agg.getUserId(),
                        requests + " lượt gọi AI trong " + SCAN_WINDOW_MINUTES + " phút (ngưỡng " + threshold + ")",
                        "{\"requests\":" + requests + ",\"windowMinutes\":" + SCAN_WINDOW_MINUTES + "}");
            }
        }
    }

    /** R2 — đốt % lớn hạn mức trong 1 giờ; chỉ gói limit ≥ min-limit VÀ có sàn token tuyệt đối. */
    private void detectQuotaBurst(LocalDateTime now) {
        long pct = longConfig("alert.r2.pct-of-limit");
        long minLimit = longConfig("alert.r2.min-limit");
        long floorTokens = longConfig("alert.r2.floor-tokens");
        if (pct <= 0) {
            return;
        }
        Map<UUID, Long> limitByUser = new HashMap<>();
        for (Subscription s : subscriptionRepository.findAllWithPlanAndUser()) {
            if (s.getPlan().getMonthlyTokenLimit() != null) {
                limitByUser.put(s.getUser().getId(), s.getPlan().getMonthlyTokenLimit());
            }
        }
        for (AiUsageRepository.UserActivityAgg agg : aiUsageRepository.activitySince(now.minusHours(1))) {
            Long limit = limitByUser.get(agg.getUserId());
            long tokens = nullToZero(agg.getTokens());
            // Gói nhỏ (FREE 1K: một lần generate đã "vượt") báo nhầm nặng → chỉ xét gói lớn + sàn tuyệt đối.
            if (limit == null || limit < minLimit || tokens < floorTokens) {
                continue;
            }
            if (tokens * 100 >= limit * pct) {
                raise(UsageAlertRule.QUOTA_BURST, UsageAlertSeverity.WARNING, agg.getUserId(),
                        "Đốt " + tokens + " token trong 1 giờ (" + (tokens * 100 / limit) + "% hạn mức gói)",
                        "{\"tokensInHour\":" + tokens + ",\"limit\":" + limit + "}");
            }
        }
    }

    /** R3 — hôm nay > ratio × TB 7 ngày; CHỈ khi đủ min-active-days ngày có hoạt động và TB ≥ min-avg. */
    private void detectDailySpike(LocalDateTime midnight) {
        long ratio = longConfig("alert.r3.ratio");
        long minAvg = longConfig("alert.r3.min-avg");
        long minActiveDays = longConfig("alert.r3.min-active-days");
        if (ratio <= 0) {
            return;
        }
        Map<UUID, long[]> baseline = new HashMap<>(); // userId -> [tokens, activeDays]
        for (UsageDailyRepository.BaselineAgg agg : usageDailyRepository.baseline(midnight.minusDays(7), midnight)) {
            baseline.put(agg.getUserId(), new long[]{nullToZero(agg.getTokens()), nullToZero(agg.getActiveDays())});
        }
        for (AiUsageRepository.UserActivityAgg agg : aiUsageRepository.activitySince(midnight)) {
            long[] base = baseline.get(agg.getUserId());
            if (base == null || base[1] < minActiveDays) {
                continue; // không đủ dữ liệu nền — bỏ qua, không chia cho mẫu số nhỏ
            }
            long avg = base[0] / base[1];
            long today = nullToZero(agg.getTokens());
            if (avg >= minAvg && today >= avg * ratio) {
                raise(UsageAlertRule.DAILY_SPIKE, UsageAlertSeverity.WARNING, agg.getUserId(),
                        "Hôm nay dùng " + today + " token — gấp " + (today / Math.max(avg, 1))
                                + " lần trung bình 7 ngày (" + avg + ")",
                        "{\"today\":" + today + ",\"avg7d\":" + avg + ",\"activeDays\":" + base[1] + "}");
            }
        }
    }

    /** R4 — nhiều IP distinct VÀ nhiều UA distinct trong 1 giờ (CẢ HAI cùng vượt mới alert). */
    private void detectMultiClient(LocalDateTime now) {
        long minIps = longConfig("alert.r4.min-ips");
        long minUas = longConfig("alert.r4.min-uas");
        if (minIps <= 0 || minUas <= 0) {
            return;
        }
        for (AiUsageRepository.UserActivityAgg agg : aiUsageRepository.activitySince(now.minusHours(1))) {
            long ips = nullToZero(agg.getDistinctIps());
            long uas = nullToZero(agg.getDistinctUas());
            // Đổi mạng (WiFi↔4G, CGNAT) đổi IP nhưng KHÔNG đổi UA — cần cả hai để nghi chia sẻ tài khoản.
            if (ips >= minIps && uas >= minUas) {
                raise(UsageAlertRule.MULTI_CLIENT, UsageAlertSeverity.WARNING, agg.getUserId(),
                        ips + " IP và " + uas + " thiết bị khác nhau trong 1 giờ — nghi chia sẻ tài khoản",
                        "{\"distinctIps\":" + ips + ",\"distinctUas\":" + uas + "}");
            }
        }
    }

    /** R5 — tỉ lệ lỗi TOÀN HỆ THỐNG: MỘT alert cấp hệ thống (provider sập bắn N alert/user là bão). */
    private void detectSystemErrorRate(LocalDateTime now) {
        long errorPct = longConfig("alert.r5.error-pct");
        long minRequests = longConfig("alert.r5.min-requests");
        if (errorPct <= 0) {
            return;
        }
        AiUsageRepository.SystemErrorAgg agg = aiUsageRepository.systemErrorsSince(now.minusHours(1));
        long requests = nullToZero(agg.getRequests());
        long errors = nullToZero(agg.getErrors());
        if (requests >= minRequests && errors * 100 >= requests * errorPct) {
            raise(UsageAlertRule.SYSTEM_ERROR_RATE, UsageAlertSeverity.WARNING, null,
                    "Tỉ lệ lỗi toàn hệ thống " + (errors * 100 / requests) + "% (" + errors + "/" + requests
                            + " trong 1 giờ) — kiểm tra provider/AI service",
                    "{\"requests\":" + requests + ",\"errors\":" + errors + "}");
        }
    }

    /** R6 — cost một user trong ngày vượt ngưỡng USD. */
    private void detectUserCost(LocalDateTime midnight) {
        BigDecimal threshold = decimalConfig("alert.r6.user-cost-usd");
        if (threshold.signum() <= 0) {
            return;
        }
        for (AiUsageRepository.UserActivityAgg agg : aiUsageRepository.activitySince(midnight)) {
            BigDecimal cost = agg.getCostUsd();
            if (cost != null && cost.compareTo(threshold) >= 0) {
                raise(UsageAlertRule.USER_COST, UsageAlertSeverity.WARNING, agg.getUserId(),
                        "Chi phí hôm nay $" + cost.setScale(2, java.math.RoundingMode.HALF_UP)
                                + " vượt ngưỡng $" + threshold,
                        "{\"costUsd\":" + cost + "}");
            }
        }
    }

    /** R7 — credit_shortfall > 0: token đã dùng nhưng không trừ được vào đâu (rò tiền, không ngưỡng). */
    private void detectShortfall(LocalDateTime now) {
        for (AiUsageRepository.ShortfallAgg agg : aiUsageRepository.shortfallSince(now.minusHours(24))) {
            long shortfall = nullToZero(agg.getShortfall());
            if (shortfall > 0) {
                raise(UsageAlertRule.CREDIT_SHORTFALL, UsageAlertSeverity.CRITICAL, agg.getUserId(),
                        shortfall + " token rò qua chỗ chặn trong 24h (credit không đủ trả phần vượt)",
                        "{\"shortfall24h\":" + shortfall + "}");
            }
        }
    }

    /** R8 — một admin GRANT/RESET vượt ngưỡng 24h; đối tượng alert = admin đó (BE ẩn với chính họ). */
    private void detectAdminAnomaly(LocalDateTime now) {
        long maxTokens = longConfig("alert.r8.grant-tokens-24h");
        long maxGrants = longConfig("alert.r8.grant-count-24h");
        long maxResets = longConfig("alert.r8.reset-count-24h");
        for (UsageAdjustmentRepository.ActorActivityAgg agg : usageAdjustmentRepository.actorActivitySince(now.minusHours(24))) {
            long granted = nullToZero(agg.getGrantedTokens());
            long grants = nullToZero(agg.getGrantCount());
            long resets = nullToZero(agg.getResetCount());
            boolean overTokens = maxTokens > 0 && granted >= maxTokens;
            boolean overGrants = maxGrants > 0 && grants >= maxGrants;
            boolean overResets = maxResets > 0 && resets >= maxResets;
            if (overTokens || overGrants || overResets) {
                raise(UsageAlertRule.ADMIN_GRANT_ANOMALY, UsageAlertSeverity.CRITICAL, agg.getActorId(),
                        "Admin " + agg.getActorEmail() + " trong 24h: cấp " + granted + " token ("
                                + grants + " lần GRANT, " + resets + " lần RESET) — vượt ngưỡng giám sát",
                        "{\"actorEmail\":\"" + agg.getActorEmail() + "\",\"grantedTokens\":" + granted
                                + ",\"grantCount\":" + grants + ",\"resetCount\":" + resets + "}");
            }
        }
    }

    /** R9 — tổng cost toàn hệ thống trong ngày (chốt chặn cuối khi rule theo user đều lọt). */
    private void detectSystemCost(LocalDateTime midnight) {
        BigDecimal threshold = decimalConfig("alert.r9.system-cost-usd");
        if (threshold.signum() <= 0) {
            return;
        }
        BigDecimal cost = aiUsageRepository.systemCostSince(midnight);
        if (cost != null && cost.compareTo(threshold) >= 0) {
            raise(UsageAlertRule.SYSTEM_COST, UsageAlertSeverity.CRITICAL, null,
                    "Tổng chi phí hệ thống hôm nay $" + cost.setScale(2, java.math.RoundingMode.HALF_UP)
                            + " vượt ngưỡng $" + threshold,
                    "{\"systemCostUsd\":" + cost + "}");
        }
    }

    /**
     * Chống bão cảnh báo: (1) đang có OPEN cùng (rule, đối tượng) → UPDATE occurrence_count++
     * + last_seen + message/data mới; (2) ACKED còn cooldown → bỏ qua; (3) còn lại → dòng mới.
     */
    private void raise(UsageAlertRule rule, UsageAlertSeverity severity, UUID userId,
                       String message, String dataJson) {
        LocalDateTime now = LocalDateTime.now();
        UsageAlert open = alertRepository.findOpen(rule, userId).orElse(null);
        if (open != null) {
            open.setOccurrenceCount(open.getOccurrenceCount() + 1);
            open.setLastSeen(now);
            open.setMessage(message);
            open.setData(dataJson);
            alertRepository.save(open);
            return;
        }
        if (alertRepository.inCooldown(rule, userId, now)) {
            return;
        }
        String email = null;
        if (userId != null) {
            email = userRepository.findById(userId).map(User::getEmail).orElse(null);
        }
        UsageAlert alert = UsageAlert.builder()
                .ruleCode(rule).severity(severity).userId(userId).userEmail(email)
                .message(message).data(dataJson)
                .firstSeen(now).lastSeen(now)
                .build();
        alertRepository.save(alert);
        log.info("[UsageAlert] {} {}: {}", rule, userId == null ? "(hệ thống)" : userId, message);
    }

    // ===== Config (system_config, cache 60s) =====

    private long longConfig(String key) {
        try {
            return Long.parseLong(effectiveConfig().get(key).trim());
        } catch (NumberFormatException e) {
            log.warn("[UsageAlert] Ngưỡng {} không phải số — dùng default", key);
            return Long.parseLong(DEFAULTS.get(key));
        }
    }

    private BigDecimal decimalConfig(String key) {
        try {
            return new BigDecimal(effectiveConfig().get(key).trim());
        } catch (NumberFormatException e) {
            log.warn("[UsageAlert] Ngưỡng {} không phải số — dùng default", key);
            return new BigDecimal(DEFAULTS.get(key));
        }
    }

    private Map<String, String> effectiveConfig() {
        Instant readAt = configCachedAt;
        Map<String, String> cached = cachedConfig;
        if (cached != null && readAt != null && Instant.now().isBefore(readAt.plusSeconds(60))) {
            return cached;
        }
        Map<String, String> merged = new LinkedHashMap<>(DEFAULTS);
        try {
            jdbcTemplate.query(
                    "SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'alert.%'",
                    rs -> {
                        merged.put(rs.getString(1), rs.getString(2));
                    });
        } catch (Exception e) {
            log.warn("[UsageAlert] Không đọc được system_config — dùng default: {}", e.getMessage());
        }
        cachedConfig = merged;
        configCachedAt = Instant.now();
        return merged;
    }

    private void invalidateConfigCache() {
        cachedConfig = null;
        configCachedAt = null;
    }

    private static long nullToZero(Long value) {
        return value == null ? 0L : value;
    }
}
