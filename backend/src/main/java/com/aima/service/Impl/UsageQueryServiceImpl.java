package com.aima.service.Impl;

import com.aima.dto.response.AiUsageByTaskResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.CursorPageResponse;
import com.aima.dto.response.HeatmapPointResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanUsageResponse;
import com.aima.dto.response.UsageModelStatResponse;
import com.aima.dto.response.UsageOverviewResponse;
import com.aima.dto.response.UsageAdjustmentResponse;
import com.aima.dto.response.UsageEventMetaResponse;
import com.aima.dto.response.UsageEventResponse;
import com.aima.dto.response.UsageSeriesPointResponse;
import com.aima.dto.response.UsageTaskStatResponse;
import com.aima.dto.response.UsageTopUserResponse;
import com.aima.dto.response.UserSessionsResponse;
import com.aima.dto.response.UserUsageDetailResponse;
import com.aima.dto.response.UserUsageResponse;
import com.aima.dto.response.UserUsageRowResponse;
import com.aima.entity.AiUsage;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.UsageAdjustment;
import com.aima.entity.User;
import com.aima.enums.UsageAdjustmentType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.mapper.UsageMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UsageAdjustmentRepository;
import com.aima.repository.UsageHourlyRepository;
import com.aima.repository.UserRepository;
import com.aima.enums.ActivityAction;
import com.aima.service.ActivityLogService;
import com.aima.service.RefreshTokenService;
import com.aima.service.SubscriptionService;
import com.aima.service.SystemLogService;
import com.aima.service.TokenUsageService;
import com.aima.service.UsageQueryService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UsageQueryServiceImpl implements UsageQueryService {

    /** Giới hạn top list tab Tổng quan + trần cửa sổ heatmap. */
    static final int TOP_MODELS = 5;
    static final int TOP_USERS = 10;
    static final int MAX_HEATMAP_DAYS = 31;

    /** Trần tab Nhật ký: page size, số dòng export (chặn kèm số thực tế), chunk đọc khi export. */
    static final int MAX_EVENT_PAGE = 100;
    static final int EXPORT_MAX_ROWS = 50_000;
    static final int EXPORT_CHUNK = 5_000;
    static final int MAX_SESSION_ROWS = 20;

    UserRepository userRepository;
    PlanRepository planRepository;
    AiUsageRepository aiUsageRepository;
    SubscriptionRepository subscriptionRepository;
    UsageAdjustmentRepository usageAdjustmentRepository;
    UsageHourlyRepository usageHourlyRepository;
    SubscriptionService subscriptionService;
    TokenUsageService tokenUsageService;
    RefreshTokenService refreshTokenService;
    SystemLogService systemLogService;
    ActivityLogService activityLogService;
    UsageMapper usageMapper;
    AiConfigMapper aiConfigMapper;

    @Override
    @Transactional // không readOnly: getOrCreate có thể tạo subscription / lăn kỳ
    public ApiResponse<UserUsageResponse> getMyUsage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        UserUsageResponse response = buildUsage(user);
        return ApiResponse.success("Lấy mức dùng token của kỳ thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PlanUsageResponse>> byPlan() {
        YearMonth month = YearMonth.now();
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();

        Map<UUID, Long> usedByUser = effectiveUsedByUser(start, end);
        Map<UUID, BigDecimal> costByUser = new HashMap<>();
        for (AiUsageRepository.UserUsageAgg agg : aiUsageRepository.aggregateByUser(start, end)) {
            if (agg.getEstimatedCost() != null) {
                costByUser.put(agg.getUserId(), agg.getEstimatedCost());
            }
        }

        // Gộp theo gói từ subscriptions (nguồn sự thật user↔gói); mọi gói đều có dòng, kể cả 0 user.
        Map<UUID, Plan> planById = new LinkedHashMap<>();
        for (Plan plan : planRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc()) {
            planById.put(plan.getId(), plan);
        }
        Map<UUID, Long> countByPlan = new HashMap<>();
        Map<UUID, Long> tokensByPlan = new HashMap<>();
        Map<UUID, BigDecimal> costByPlan = new HashMap<>();
        for (Subscription subscription : subscriptionRepository.findAllWithPlanAndUser()) {
            UUID planId = subscription.getPlan().getId();
            if (!planById.containsKey(planId)) {
                continue; // gói đã xóa mềm — không hiển thị
            }
            UUID userId = subscription.getUser().getId();
            countByPlan.merge(planId, 1L, Long::sum);
            tokensByPlan.merge(planId, usedByUser.getOrDefault(userId, 0L), Long::sum);
            BigDecimal cost = costByUser.get(userId);
            if (cost != null) {
                costByPlan.merge(planId, cost, BigDecimal::add);
            }
        }

        List<PlanUsageResponse> result = planById.values().stream()
                .map(plan -> usageMapper.toPlanUsage(plan,
                        countByPlan.getOrDefault(plan.getId(), 0L),
                        tokensByPlan.getOrDefault(plan.getId(), 0L),
                        costByPlan.get(plan.getId())))
                .toList();
        return ApiResponse.success("Lấy usage theo gói thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<UserUsageRowResponse>> byUser(String filter, String q, int page, int size) {
        YearMonth month = YearMonth.now();
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();

        Map<UUID, Long> usedByUser = effectiveUsedByUser(start, end);
        String needle = q == null ? "" : q.trim().toLowerCase();

        List<UserUsageRowResponse> rows = subscriptionRepository.findAllWithPlanAndUser().stream()
                .map(s -> usageMapper.toUserRow(s, usedByUser.getOrDefault(s.getUser().getId(), 0L)))
                .filter(row -> needle.isEmpty()
                        || (row.getEmail() != null && row.getEmail().toLowerCase().contains(needle))
                        || (row.getFullName() != null && row.getFullName().toLowerCase().contains(needle)))
                .filter(row -> matchesThreshold(row, filter))
                .sorted((a, b) -> Long.compare(b.getUsed(), a.getUsed()))
                .toList();

        int safeSize = Math.max(1, size);
        int totalPages = (int) Math.ceil(rows.size() / (double) safeSize);
        int safePage = Math.max(0, page);
        int fromIdx = Math.min(safePage * safeSize, rows.size());
        int toIdx = Math.min(fromIdx + safeSize, rows.size());

        PageResponse<UserUsageRowResponse> pageResponse = PageResponse.<UserUsageRowResponse>builder()
                .content(rows.subList(fromIdx, toIdx))
                .page(safePage)
                .size(safeSize)
                .totalElements(rows.size())
                .totalPages(totalPages)
                .last(safePage >= totalPages - 1)
                .build();
        return ApiResponse.success("Lấy usage theo người dùng thành công", pageResponse);
    }

    @Override
    @Transactional // không readOnly: buildUsage → getOrCreate có thể ghi
    public ApiResponse<UserUsageDetailResponse> getUserDetail(UUID userId) {
        User user = userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        UserUsageResponse usage = buildUsage(user);
        List<UsageAdjustment> adjustments = usageAdjustmentRepository.findAllByUserInWindow(
                userId, usage.getPeriodStart(), usage.getPeriodEnd());
        // Lượng "rò" qua chỗ chặn kỳ này (credit không đủ trả phần vượt — cho phép âm, không rollback).
        Long creditShortfall = aiUsageRepository
                .sumCreditForUser(userId, usage.getPeriodStart(), usage.getPeriodEnd()).getCreditShortfall();
        UserUsageDetailResponse response = usageMapper.toUserDetail(
                user, usage, creditShortfall, usageMapper.toAdjustmentResponseList(adjustments));
        return ApiResponse.success("Lấy chi tiết usage người dùng thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<Integer> reconcile() {
        YearMonth month = YearMonth.now();
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        String monthKey = month.toString();

        int updated = 0;
        for (User user : userRepository.findAll()) {
            if (user.getDeletedAt() != null) {
                continue;
            }
            long sum = aiUsageRepository.sumTokensForUser(user.getId(), start, end);
            boolean stale = !monthKey.equals(user.getTokenUsageMonth())
                    || user.getTokensUsed() == null
                    || user.getTokensUsed() != sum;
            if (stale) {
                user.setTokenUsageMonth(monthKey);
                user.setTokensUsed(sum);
                userRepository.save(user);
                updated++;
            }
        }
        log.info("[Usage] Reconcile cache tokens_used từ ai_usage: {} user cập nhật (kỳ {})", updated, monthKey);
        return ApiResponse.success("Đã đối soát cache token từ event log ai_usage", updated);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UsageOverviewResponse> overview() {
        YearMonth month = YearMonth.now();
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        LocalDateTime prevStart = month.minusMonths(1).atDay(1).atStartOfDay();

        UsageHourlyRepository.TotalsAgg totals = usageHourlyRepository.totals(start, end);
        UsageHourlyRepository.TotalsAgg prev = usageHourlyRepository.totals(prevStart, start);
        Long prevTokens = prev.getTotalTokens();
        Long deltaPct = (prevTokens == null || prevTokens <= 0) ? null
                : Math.round((totals.getTotalTokens() - prevTokens) * 100.0 / prevTokens);

        List<UsageTaskStatResponse> topFeatures = usageMapper.toTaskStatList(
                usageHourlyRepository.byTask(start, end));
        List<UsageModelStatResponse> topModels = usageMapper.toModelStatList(
                usageHourlyRepository.byModel(start, end).stream().limit(TOP_MODELS).toList());

        // Top user: gộp theo userId từ rollup rồi nạp thông tin user một lượt (không join native).
        List<UsageHourlyRepository.UserAgg> userAggs =
                usageHourlyRepository.topUsers(start, end, PageRequest.of(0, TOP_USERS));
        Map<UUID, User> usersById = new HashMap<>();
        userRepository.findAllById(userAggs.stream().map(UsageHourlyRepository.UserAgg::getUserId).toList())
                .forEach(u -> usersById.put(u.getId(), u));
        List<UsageTopUserResponse> topUsers = userAggs.stream()
                .filter(agg -> usersById.containsKey(agg.getUserId()))
                .map(agg -> usageMapper.toTopUser(usersById.get(agg.getUserId()),
                        agg.getTotalTokens(), agg.getCostUsd()))
                .toList();

        UsageOverviewResponse response = usageMapper.toOverview(
                start, end, totals, prevTokens, deltaPct, topFeatures, topModels, topUsers);
        return ApiResponse.success("Lấy tổng quan usage thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<HeatmapPointResponse>> heatmap(int days, UUID userId) {
        int safeDays = Math.min(Math.max(days, 1), MAX_HEATMAP_DAYS);
        LocalDateTime to = LocalDateTime.now().plusHours(1).truncatedTo(java.time.temporal.ChronoUnit.HOURS);
        LocalDateTime from = to.minusDays(safeDays);
        List<UsageHourlyRepository.HeatPoint> points = userId == null
                ? usageHourlyRepository.heatmap(from, to)
                : usageHourlyRepository.heatmapForUser(userId, from, to);
        List<HeatmapPointResponse> response = points.stream()
                .map(point -> usageMapper.toHeatPoint(point, latencyAvg(point)))
                .toList();
        return ApiResponse.success("Lấy heatmap usage thành công", response);
    }

    /** Trung bình latency LOẠI event không đo được (NULL) — không coalesce 0 làm lệch số. */
    private static Long latencyAvg(UsageHourlyRepository.HeatPoint point) {
        Long sum = point.getLatencySumMs();
        Long count = point.getLatencyCount();
        if (sum == null || count == null || count <= 0) {
            return null;
        }
        return Math.round(sum / (double) count);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<UsageEventResponse>> events(EventFilter f, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_EVENT_PAGE));
        Page<AiUsage> rows = aiUsageRepository.searchEvents(f.from(), f.to(), f.userId(),
                f.taskCodeName(), f.model(), f.statusName(), f.minTokens(), f.minCost(), pageable);

        List<UsageEventResponse> content = usageMapper.toEventResponseList(rows.getContent());
        PageResponse<UsageEventResponse> response = PageResponse.from(rows, content);
        return ApiResponse.success("Lấy nhật ký sử dụng thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UsageEventMetaResponse> eventMeta(String actorEmail, UUID eventId) {
        AiUsage event = aiUsageRepository.findById(eventId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USAGE_EVENT_NOT_FOUND));
        // IP/UA là dữ liệu cá nhân — audit MỖI lần xem (REQUIRES_NEW nên sống qua readOnly tx).
        String subject = event.getUser() == null ? "(hệ thống)" : event.getUser().getEmail();
        systemLogService.info("admin.usage.meta",
                "Xem IP/UA event usage: actor=" + actorEmail + ", eventId=" + eventId
                        + ", subjectUser=" + subject);
        // Dual-write giai đoạn chuyển tiếp: dòng system_logs ở trên là nơi ghi CŨ (đã bị ẩn khỏi
        // tab lỗi), dòng dưới là nơi ghi MỚI. Bỏ lệnh systemLogService.info sau khi chốt.
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USAGE_META_VIEWED, actorEmail, "AiUsage", eventId.toString(),
                Map.of("subjectUser", subject)));
        UsageEventMetaResponse response = usageMapper.toEventMeta(event);
        return ApiResponse.success("Lấy IP/User-Agent của bản ghi thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Long> countEvents(EventFilter f) {
        long count = aiUsageRepository.countEvents(f.from(), f.to(), f.userId(), f.taskCodeName(),
                f.model(), f.statusName(), f.minTokens(), f.minCost());
        return ApiResponse.success("Đếm nhật ký sử dụng thành công", count);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<String> exportEvents(String actorEmail, EventFilter f) {
        long count = aiUsageRepository.countEvents(f.from(), f.to(), f.userId(), f.taskCodeName(),
                f.model(), f.statusName(), f.minTokens(), f.minCost());
        if (count > EXPORT_MAX_ROWS) {
            // KHÔNG cắt cụt im lặng — FE hiển thị số dòng thực tế (countEvents) để admin thu hẹp filter.
            throw new AppException(ErrorCode.USAGE_EXPORT_TOO_LARGE);
        }

        StringBuilder csv = new StringBuilder("created_at,user_email,task,provider,model,input_tokens,"
                + "output_tokens,cached_tokens,total_tokens,billable_units,credit_units,latency_ms,"
                + "cost_usd,status,request_id,client_ip,user_agent\n");
        String cursor = null;
        do {
            Pageable page = PageRequest.of(0, EXPORT_CHUNK + 1);
            List<AiUsage> rows = cursor == null
                    ? aiUsageRepository.findEventsFirstPage(f.from(), f.to(), f.userId(), f.taskCodeName(),
                            f.model(), f.statusName(), f.minTokens(), f.minCost(), page)
                    : aiUsageRepository.findEventsAfterCursor(decodeCursor(cursor).createdAt(),
                            decodeCursor(cursor).id(), f.from(), f.to(), f.userId(), f.taskCodeName(),
                            f.model(), f.statusName(), f.minTokens(), f.minCost(), page);
            boolean hasMore = rows.size() > EXPORT_CHUNK;
            List<AiUsage> chunk = hasMore ? rows.subList(0, EXPORT_CHUNK) : rows;
            chunk.forEach(u -> appendCsvRow(csv, u));
            cursor = hasMore ? encodeCursor(chunk.get(chunk.size() - 1)) : null;
        } while (cursor != null);

        // CSV chứa IP/UA (dữ liệu cá nhân) — audit export như audit xem meta.
        systemLogService.info("admin.usage.export",
                "Export CSV nhật ký usage: actor=" + actorEmail + ", rows=" + count
                        + ", filter={from=" + f.from() + ", to=" + f.to() + ", userId=" + f.userId()
                        + ", task=" + f.taskCode() + ", model=" + f.model() + ", status=" + f.status() + "}");
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.DATA_EXPORTED, actorEmail, "AiUsage", null,
                Map.of("rows", count, "from", String.valueOf(f.from()), "to", String.valueOf(f.to()),
                        "userId", String.valueOf(f.userId()), "task", String.valueOf(f.taskCode()),
                        "model", String.valueOf(f.model()), "status", String.valueOf(f.status()))));
        return ApiResponse.success("Export nhật ký sử dụng thành công", csv.toString());
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<UsageAdjustmentResponse>> getUserAdjustments(UUID userId) {
        userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        List<UsageAdjustmentResponse> adjustments = usageMapper.toAdjustmentResponseList(
                usageAdjustmentRepository.findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(userId));
        return ApiResponse.success("Lấy lịch sử điều chỉnh toàn thời gian thành công", adjustments);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UserSessionsResponse> getUserSessions(String actorEmail, UUID userId) {
        User user = userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        // Trả IP (dữ liệu cá nhân) → audit như eventMeta.
        systemLogService.info("admin.usage.sessions",
                "Xem phiên & thiết bị: actor=" + actorEmail + ", subjectUser=" + user.getEmail()
                        + " (" + userId + ")");
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_SESSIONS_VIEWED, actorEmail, "User", userId.toString(),
                Map.of("subjectUser", user.getEmail())));

        List<UserSessionsResponse.SessionRow> clients = usageMapper.toSessionRowList(
                aiUsageRepository.aggregateClientsForUser(userId, PageRequest.of(0, MAX_SESSION_ROWS)));
        long activeSessions = refreshTokenService.countActiveSessions(userId.toString());
        UserSessionsResponse response = UserSessionsResponse.builder()
                .activeSessionCount(activeSessions)
                .recentClients(clients)
                .build();
        return ApiResponse.success("Lấy phiên & thiết bị thành công", response);
    }

    /** Cursor mờ "epochMilli_id" base64url — FE truyền lại nguyên văn. */
    private record Cursor(LocalDateTime createdAt, UUID id) {
    }

    private static String encodeCursor(AiUsage last) {
        String raw = last.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                + "_" + last.getId();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static Cursor decodeCursor(String cursor) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int sep = raw.indexOf('_');
            LocalDateTime createdAt = Instant.ofEpochMilli(Long.parseLong(raw.substring(0, sep)))
                    .atZone(ZoneId.systemDefault()).toLocalDateTime();
            return new Cursor(createdAt, UUID.fromString(raw.substring(sep + 1)));
        } catch (Exception e) {
            throw new AppException(ErrorCode.USAGE_CURSOR_INVALID);
        }
    }

    private static void appendCsvRow(StringBuilder csv, AiUsage u) {
        csv.append(u.getCreatedAt()).append(',')
                .append(csvField(u.getUser() == null ? null : u.getUser().getEmail())).append(',')
                .append(u.getTaskCode()).append(',')
                .append(u.getProviderCode()).append(',')
                .append(csvField(u.getModelCode())).append(',')
                .append(nullToEmpty(u.getInputTokens())).append(',')
                .append(nullToEmpty(u.getOutputTokens())).append(',')
                .append(nullToEmpty(u.getCachedTokens())).append(',')
                .append(u.getTotalTokens()).append(',')
                .append(u.getBillableUnits() == null ? u.getTotalTokens() : u.getBillableUnits()).append(',')
                .append(nullToEmpty(u.getCreditUnits())).append(',')
                .append(nullToEmpty(u.getLatencyMs())).append(',')
                .append(u.getEstimatedCost() == null ? "" : u.getEstimatedCost().toPlainString()).append(',')
                .append(u.getStatus() == null ? "SUCCESS" : u.getStatus()).append(',')
                .append(u.getRequestId() == null ? "" : u.getRequestId()).append(',')
                .append(csvField(u.getClientIp())).append(',')
                .append(csvField(u.getUserAgent())).append('\n');
    }

    /** Escape CSV chuẩn: bọc ngoặc kép khi chứa dấu phẩy/ngoặc/xuống dòng. */
    private static String csvField(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return '"' + value.replace("\"", "\"\"") + '"';
        }
        return value;
    }

    private static String nullToEmpty(Long value) {
        return value == null ? "" : value.toString();
    }

    /** Khối usage dùng chung cho trang user (getMyUsage) và modal chi tiết admin. */
    private UserUsageResponse buildUsage(User user) {
        Subscription subscription = subscriptionService.getOrCreate(user);
        LocalDateTime start;
        LocalDateTime end;
        Plan plan;
        if (subscription != null) {
            start = subscription.getCurrentPeriodStart();
            end = subscription.getCurrentPeriodEnd();
            plan = subscription.getPlan();
        } else {
            YearMonth month = YearMonth.now();
            start = month.atDay(1).atStartOfDay();
            end = month.plusMonths(1).atDay(1).atStartOfDay();
            plan = null;
        }

        TokenUsageService.QuotaState quota = tokenUsageService.state(user);
        List<UsageSeriesPointResponse> series = usageMapper.toSeriesPointList(
                aiUsageRepository.aggregateDailyForUser(user.getId(), start, end));
        List<AiUsageByTaskResponse> byFeature = aiConfigMapper.toByTaskResponseList(
                aiUsageRepository.aggregateByTaskForUser(user.getId(), start, end));

        // Gói đang áp hạn mức + mốc đổi gói chờ (hạ gói giữa kỳ hiệu lực từ kỳ sau).
        String effectivePlan = plan == null ? null : plan.getCode();
        LocalDateTime pendingChangeAt = TokenUsageServiceImpl.pendingPlanChangeAt(user, subscription);
        // Tổng tiêu thụ thật hiển thị 2 phần: used (hạn mức gói) + creditUsed (token mua thêm).
        long creditUsed = aiUsageRepository.sumCreditForUser(user.getId(), start, end).getCreditUsed();

        return usageMapper.toUsageResponse(
                YearMonth.from(start).toString(), start, end, quota, plan,
                effectivePlan, pendingChangeAt, creditUsed, series, byFeature);
    }

    /**
     * Mức dùng hiệu lực theo TỪNG user trong cửa sổ (cùng công thức TokenUsageService.state):
     * 3 query gộp cho số đông; user có mốc RESET (số ít) tính lại riêng từ mốc đó.
     */
    private Map<UUID, Long> effectiveUsedByUser(LocalDateTime start, LocalDateTime end) {
        Map<UUID, Long> used = new HashMap<>();
        for (AiUsageRepository.UserUsageAgg agg : aiUsageRepository.aggregateByUser(start, end)) {
            used.put(agg.getUserId(), agg.getBillableUnits() == null ? 0L : agg.getBillableUnits());
        }
        for (UsageAdjustmentRepository.UserGrantAgg agg : usageAdjustmentRepository.aggregateGrantsByUser(start, end)) {
            long granted = agg.getGranted() == null ? 0L : agg.getGranted();
            used.merge(agg.getUserId(), -granted, Long::sum);
        }
        used.replaceAll((id, value) -> Math.max(0, value));

        // User có RESET trong kỳ: chỉ tính event/grant SAU mốc reset gần nhất.
        Set<UUID> resetUsers = new HashSet<>(usageAdjustmentRepository.findUserIdsWithReset(start, end));
        for (UUID userId : resetUsers) {
            LocalDateTime from = usageAdjustmentRepository
                    .findByUserAndTypeInWindow(userId, UsageAdjustmentType.RESET, start, end)
                    .stream().findFirst()
                    .map(UsageAdjustment::getCreatedAt)
                    .orElse(start);
            long raw = aiUsageRepository.sumTokensForUser(userId, from, end);
            long granted = usageAdjustmentRepository.sumGrantedForUser(userId, from, end);
            used.put(userId, Math.max(0, raw - granted));
        }
        return used;
    }

    /** filter: "warning" = ≥80% chưa vượt; "exceeded" = ≥100%; khác/rỗng = tất cả. */
    private static boolean matchesThreshold(UserUsageRowResponse row, String filter) {
        if (filter == null || filter.isBlank()) {
            return true;
        }
        Long limit = row.getLimit();
        if (limit == null || limit <= 0) {
            return false; // không giới hạn → không bao giờ chạm ngưỡng
        }
        long used = row.getUsed() == null ? 0L : row.getUsed();
        return switch (filter) {
            case "warning" -> used * 100 >= limit * 80 && used < limit;
            case "exceeded" -> used >= limit;
            default -> true;
        };
    }
}
