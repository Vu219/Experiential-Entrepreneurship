package com.aima.controller;

import com.aima.dto.request.AckAlertRequest;
import com.aima.dto.request.BillingRateRequest;
import com.aima.dto.request.GrantTokensRequest;
import com.aima.dto.request.ResetUsageRequest;
import com.aima.dto.response.AlertRuleStatResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingRateResponse;
import com.aima.dto.response.CursorPageResponse;
import com.aima.dto.response.HeatmapPointResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanUsageResponse;
import com.aima.dto.response.UsageAlertResponse;
import com.aima.dto.response.UsageEventMetaResponse;
import com.aima.dto.response.UsageEventResponse;
import com.aima.dto.response.UsageOverviewResponse;
import com.aima.dto.response.UserSessionsResponse;
import com.aima.dto.response.TokenCreditResponse;
import com.aima.dto.response.UsageAdjustmentResponse;
import com.aima.dto.response.UserUsageDetailResponse;
import com.aima.dto.response.UserUsageRowResponse;
import com.aima.enums.AiTaskCode;
import com.aima.enums.AiUsageStatus;
import com.aima.enums.UsageAlertStatus;
import com.aima.service.BillingRateService;
import com.aima.service.TokenCreditService;
import com.aima.service.UsageAdjustmentService;
import com.aima.service.UsageAlertService;
import com.aima.service.UsageQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Quản trị usage token theo gói/user (trang admin "Token & hạn mức"). Nguồn dữ liệu:
 * event log {@code ai_usage} + {@code usage_adjustments}; hạn mức vẫn sửa ở Quản lý gói.
 */
@RestController
@RequestMapping("/admin/usage")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Token Usage", description = "Usage token đối chiếu hạn mức gói — gộp từ event log ai_usage; "
        + "cấp thêm/reset ghi audit append-only vào usage_adjustments.")
public class AdminUsageController {

    UsageQueryService usageQueryService;
    UsageAdjustmentService usageAdjustmentService;
    BillingRateService billingRateService;
    TokenCreditService tokenCreditService;
    UsageAlertService usageAlertService;

    @GetMapping("/overview")
    @Operation(summary = "Tab Tổng quan: tổng kỳ này so kỳ trước + top tính năng/model/user + tỉ lệ lỗi "
            + "— đọc từ rollup usage_hourly")
    public ApiResponse<UsageOverviewResponse> overview() {
        return usageQueryService.overview();
    }

    @GetMapping("/heatmap")
    @Operation(summary = "Heatmap bucket giờ (GIỜ VN) của N ngày gần nhất; userId trống = toàn hệ thống; "
            + "FE tự chọn metric (token/request/cost/latency)")
    public ApiResponse<List<HeatmapPointResponse>> heatmap(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(required = false) UUID userId) {
        return usageQueryService.heatmap(days, userId);
    }

    @GetMapping("/by-plan")
    @Operation(summary = "Usage kỳ này theo gói: số user + tổng token/chi phí so hạn mức (chỉ đọc/gộp)")
    public ApiResponse<List<PlanUsageResponse>> byPlan() {
        return usageQueryService.byPlan();
    }

    @GetMapping("/by-user")
    @Operation(summary = "Usage kỳ này theo user — filter=warning (≥80% chưa vượt) / exceeded (≥100%), q tìm tên/email")
    public ApiResponse<PageResponse<UserUsageRowResponse>> byUser(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return usageQueryService.byUser(filter, q, page, size);
    }

    @GetMapping("/users/{userId}")
    @Operation(summary = "Chi tiết usage một user: tổng kỳ + series ngày + breakdown nghiệp vụ + lịch sử điều chỉnh")
    public ApiResponse<UserUsageDetailResponse> getUserDetail(@PathVariable UUID userId) {
        return usageQueryService.getUserDetail(userId);
    }

    @PostMapping("/users/{userId}/grant")
    @Operation(summary = "Cấp thêm token trong kỳ (usage_adjustments GRANT — kiêm audit, mở lại user bị chặn 100%)")
    public ApiResponse<UsageAdjustmentResponse> grant(@AuthenticationPrincipal UserDetails principal,
                                                      @PathVariable UUID userId,
                                                      @Valid @RequestBody GrantTokensRequest request) {
        return usageAdjustmentService.grant(principal.getUsername(), userId, request);
    }

    @PostMapping("/users/{userId}/reset")
    @Operation(summary = "Reset mức dùng kỳ này về 0 từ bây giờ (usage_adjustments RESET — kiêm audit)")
    public ApiResponse<UsageAdjustmentResponse> reset(@AuthenticationPrincipal UserDetails principal,
                                                      @PathVariable UUID userId,
                                                      @RequestBody(required = false) ResetUsageRequest request) {
        return usageAdjustmentService.reset(principal.getUsername(), userId, request);
    }

    @PostMapping("/reconcile")
    @Operation(summary = "Dựng lại cache users.tokens_used từ event log ai_usage (tháng hiện tại) — trả số user cập nhật")
    public ApiResponse<Integer> reconcile() {
        return usageQueryService.reconcile();
    }

    @GetMapping("/alerts")
    @Operation(summary = "Cảnh báo bất thường (pha 5A alert-only): mặc định OPEN; userId lọc theo user "
            + "(banner trang chi tiết); R8 tự ẩn với chính admin bị giám sát")
    public ApiResponse<List<UsageAlertResponse>> alerts(@AuthenticationPrincipal UserDetails principal,
                                                        @RequestParam(required = false) UsageAlertStatus status,
                                                        @RequestParam(required = false) UUID userId) {
        return usageAlertService.list(principal.getUsername(), status, userId);
    }

    @PostMapping("/alerts/{alertId}/ack")
    @Operation(summary = "Xác nhận cảnh báo (đặt cooldown; falsePositive=true = đánh dấu báo nhầm — "
            + "nuôi báo cáo FP); ghi audit")
    public ApiResponse<UsageAlertResponse> ackAlert(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID alertId,
                                                    @RequestBody(required = false) AckAlertRequest request) {
        return usageAlertService.ack(principal.getUsername(), alertId, request);
    }

    @GetMapping("/alerts/stats")
    @Operation(summary = "Đo báo nhầm theo rule: tổng alert / số false positive / tỉ lệ % — căn cứ "
            + "quyết định rule nào đủ chín sang 5B (tự động chặn)")
    public ApiResponse<List<AlertRuleStatResponse>> alertStats() {
        return usageAlertService.stats();
    }

    @GetMapping("/alert-config")
    @Operation(summary = "Ngưỡng 9 rule hiện hành (default phủ bởi system_config — chỉnh không cần deploy)")
    public ApiResponse<Map<String, String>> alertConfig() {
        return usageAlertService.getConfig();
    }

    @PutMapping("/alert-config")
    @Operation(summary = "Cập nhật ngưỡng rule (chỉ key hợp lệ, giá trị số không âm; 0 = tắt rule); ghi audit")
    public ApiResponse<Map<String, String>> updateAlertConfig(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, String> changes) {
        return usageAlertService.updateConfig(principal.getUsername(), changes);
    }

    @GetMapping("/rates")
    @Operation(summary = "Hệ số quy đổi hạn mức (billing_rates) — toàn bộ lịch sử version, mới nhất trước")
    public ApiResponse<List<BillingRateResponse>> listRates() {
        return billingRateService.list();
    }

    @GetMapping("/events")
    @Operation(summary = "Nhật ký sử dụng: phân trang offset (mới nhất trước); KHÔNG kèm IP/UA — lấy riêng "
            + "qua /events/{id}/meta (có audit). Retention: SUCCESS 90 ngày, ERROR/TIMEOUT 180 ngày")
    public ApiResponse<PageResponse<UsageEventResponse>> events(
            @RequestParam(required = false) LocalDateTime from,
            @RequestParam(required = false) LocalDateTime to,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) AiTaskCode taskCode,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) AiUsageStatus status,
            @RequestParam(required = false) Long minTokens,
            @RequestParam(required = false) BigDecimal minCost,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        UsageQueryService.EventFilter filter = new UsageQueryService.EventFilter(
                from, to, userId, taskCode, model, status, minTokens, minCost);
        return usageQueryService.events(filter, page, size);
    }

    @GetMapping("/events/{eventId}/meta")
    @Operation(summary = "IP/User-Agent của MỘT event — dữ liệu cá nhân, MỖI lần gọi ghi audit "
            + "system_logs (ai xem, của user nào, lúc nào)")
    public ApiResponse<UsageEventMetaResponse> eventMeta(@AuthenticationPrincipal UserDetails principal,
                                                         @PathVariable UUID eventId) {
        return usageQueryService.eventMeta(principal.getUsername(), eventId);
    }

    @GetMapping("/events/count")
    @Operation(summary = "Số dòng khớp filter — FE gọi trước Export để báo số thực tế khi vượt trần 50K")
    public ApiResponse<Long> countEvents(
            @RequestParam(required = false) LocalDateTime from,
            @RequestParam(required = false) LocalDateTime to,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) AiTaskCode taskCode,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) AiUsageStatus status,
            @RequestParam(required = false) Long minTokens,
            @RequestParam(required = false) BigDecimal minCost) {
        UsageQueryService.EventFilter filter = new UsageQueryService.EventFilter(
                from, to, userId, taskCode, model, status, minTokens, minCost);
        return usageQueryService.countEvents(filter);
    }

    @GetMapping("/events/export")
    @Operation(summary = "Export CSV (chuỗi trong result — FE tạo file); vượt 50.000 dòng → lỗi 2031, "
            + "KHÔNG cắt cụt im lặng; CSV chứa IP/UA nên mỗi lần export ghi audit")
    public ApiResponse<String> exportEvents(@AuthenticationPrincipal UserDetails principal,
                                            @RequestParam(required = false) LocalDateTime from,
                                            @RequestParam(required = false) LocalDateTime to,
                                            @RequestParam(required = false) UUID userId,
                                            @RequestParam(required = false) AiTaskCode taskCode,
                                            @RequestParam(required = false) String model,
                                            @RequestParam(required = false) AiUsageStatus status,
                                            @RequestParam(required = false) Long minTokens,
                                            @RequestParam(required = false) BigDecimal minCost) {
        UsageQueryService.EventFilter filter = new UsageQueryService.EventFilter(
                from, to, userId, taskCode, model, status, minTokens, minCost);
        return usageQueryService.exportEvents(principal.getUsername(), filter);
    }

    @GetMapping("/users/{userId}/adjustments")
    @Operation(summary = "Audit cấp/reset TOÀN THỜI GIAN của một user (tab Audit trang chi tiết)")
    public ApiResponse<List<UsageAdjustmentResponse>> userAdjustments(@PathVariable UUID userId) {
        return usageQueryService.getUserAdjustments(userId);
    }

    @GetMapping("/users/{userId}/sessions")
    @Operation(summary = "Phiên & thiết bị: IP/UA distinct từ event log + số session đồng thời (Redis) "
            + "— trả IP nên MỖI lần gọi ghi audit")
    public ApiResponse<UserSessionsResponse> userSessions(@AuthenticationPrincipal UserDetails principal,
                                                          @PathVariable UUID userId) {
        return usageQueryService.getUserSessions(principal.getUsername(), userId);
    }

    @PostMapping("/users/{userId}/dev-credits")
    @Operation(summary = "DEV-ONLY (cờ aima.dev.credit-seed-enabled, mặc định tắt — mã 2029): seed token_credits "
            + "để verify quy tắc bucket trước khi có payment. scenario = SIMPLE | FIFO | EXPIRY")
    public ApiResponse<List<TokenCreditResponse>> devSeedCredits(@AuthenticationPrincipal UserDetails principal,
                                                                 @PathVariable UUID userId,
                                                                 @RequestParam(required = false) String scenario) {
        return tokenCreditService.devSeed(principal.getUsername(), userId, scenario);
    }

    @PostMapping("/rates")
    @Operation(summary = "Thêm VERSION hệ số quy đổi mới (append-only — tự đóng version đang mở cùng scope, "
            + "không sửa đè; billable_units của event cũ giữ nguyên)")
    public ApiResponse<BillingRateResponse> createRate(@AuthenticationPrincipal UserDetails principal,
                                                       @Valid @RequestBody BillingRateRequest request) {
        return billingRateService.create(principal.getUsername(), request);
    }
}
