package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.CursorPageResponse;
import com.aima.dto.response.HeatmapPointResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanUsageResponse;
import com.aima.dto.response.UsageAdjustmentResponse;
import com.aima.dto.response.UsageEventMetaResponse;
import com.aima.dto.response.UsageEventResponse;
import com.aima.dto.response.UsageOverviewResponse;
import com.aima.dto.response.UserSessionsResponse;
import com.aima.dto.response.UserUsageDetailResponse;
import com.aima.dto.response.UserUsageResponse;
import com.aima.dto.response.UserUsageRowResponse;
import com.aima.enums.AiTaskCode;
import com.aima.enums.AiUsageStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Đọc/gộp usage token từ event log {@code ai_usage}: trang usage của user + hai view
 * admin per-plan / per-user (chỉ đọc — grant/reset ở {@code UsageAdjustmentService}).
 */
public interface UsageQueryService {

    /** GET /users/me/usage — tổng kỳ + biểu đồ ngày + breakdown theo nghiệp vụ + gói hiện tại. */
    ApiResponse<UserUsageResponse> getMyUsage(String email);

    /**
     * GET /admin/usage/by-plan — mỗi gói: số user + tổng token/chi phí so hạn mức. {@code from}/{@code to}
     * null = kỳ này (tính như enforcement: event − grant, tôn trọng reset); có khoảng = xem LỊCH SỬ từ
     * rollup usage_hourly (không trừ grant/reset — đó là điều chỉnh hạn mức, không phải tiêu thụ), gom
     * theo gói HIỆN TẠI của user (chưa join subscription_history).
     */
    ApiResponse<List<PlanUsageResponse>> byPlan(LocalDate from, LocalDate to);

    /**
     * GET /admin/usage/by-user — usage kỳ này theo user; {@code filter}: "warning" (≥80%
     * chưa vượt) / "exceeded" (≥100%) / rỗng = tất cả; {@code q} tìm tên/email. Lọc theo
     * ngưỡng cần mức dùng TÍNH TOÁN nên gộp toàn bộ rồi phân trang tại chỗ (quy mô user
     * hiện nhỏ; chuyển materialized khi lớn). Có {@code from}/{@code to} = xem lịch sử như
     * {@link #byPlan}; khi đó {@code filter} bị bỏ qua (ngưỡng % hạn mức chỉ có nghĩa với kỳ đang chạy).
     */
    ApiResponse<PageResponse<UserUsageRowResponse>> byUser(String filter, String q, int page, int size,
                                                           LocalDate from, LocalDate to);

    /** GET /admin/usage/users/{id} — chi tiết usage một user + lịch sử điều chỉnh kỳ này. */
    ApiResponse<UserUsageDetailResponse> getUserDetail(UUID userId);

    /**
     * POST /admin/usage/reconcile — dựng lại cache {@code users.tokens_used} từ event log
     * cho tháng hiện tại (khi nghi lệch). Trả số user được cập nhật.
     */
    ApiResponse<Integer> reconcile();

    /**
     * GET /admin/usage/overview — tab Tổng quan: tổng kỳ này so kỳ trước + top tính năng/
     * model/user + tỉ lệ lỗi. Toàn bộ đọc từ ROLLUP usage_hourly (không query thẳng event).
     * {@code from}/{@code to} null = tháng hiện tại so tháng trước; có khoảng (to bao gồm, ≤ 366
     * ngày) = khoảng đó so với khoảng liền trước cùng độ dài.
     */
    ApiResponse<UsageOverviewResponse> overview(LocalDate from, LocalDate to);

    /**
     * GET /admin/usage/heatmap — bucket giờ (GIỜ VN) của {@code days} ngày gần nhất;
     * {@code userId} null = toàn hệ thống. FE tự chọn metric phía client. Có {@code from}/{@code to}
     * thì dùng khoảng đó (≤ 366 ngày) thay cho {@code days}.
     */
    ApiResponse<List<HeatmapPointResponse>> heatmap(int days, UUID userId, LocalDate from, LocalDate to);

    /**
     * GET /admin/usage/events — tab Nhật ký sử dụng: phân trang OFFSET (mới nhất trước), đúng
     * pattern phân trang chung của các trang quản trị. Response KHÔNG chứa IP/UA (dữ liệu cá
     * nhân — lấy riêng qua eventMeta, có audit).
     */
    ApiResponse<PageResponse<UsageEventResponse>> events(EventFilter filter, int page, int size);

    /**
     * GET /admin/usage/events/{id}/meta — IP/User-Agent của MỘT event; MỖI lần gọi ghi audit
     * system_logs (admin nào xem, của user nào, lúc nào) vì đây là dữ liệu cá nhân.
     */
    ApiResponse<UsageEventMetaResponse> eventMeta(String actorEmail, UUID eventId);

    /** GET /admin/usage/events/count — số dòng khớp filter (hiện cạnh Export, chặn > trần). */
    ApiResponse<Long> countEvents(EventFilter filter);

    /**
     * GET /admin/usage/events/export — CSV (chuỗi trong result, FE tự tạo file). Vượt trần
     * 50.000 dòng → USAGE_EXPORT_TOO_LARGE, KHÔNG cắt cụt im lặng (FE báo kèm số thực tế từ
     * countEvents). CSV chứa IP/UA nên mỗi lần export cũng ghi audit.
     */
    ApiResponse<String> exportEvents(String actorEmail, EventFilter filter);

    /** GET /admin/usage/users/{id}/adjustments — audit cấp/reset TOÀN THỜI GIAN (không chỉ kỳ này). */
    ApiResponse<List<UsageAdjustmentResponse>> getUserAdjustments(UUID userId);

    /**
     * GET /admin/usage/users/{id}/sessions — IP/UA distinct + số session đồng thời (Redis).
     * Trả IP → ghi audit mỗi lần gọi, cùng lý do eventMeta.
     */
    ApiResponse<UserSessionsResponse> getUserSessions(String actorEmail, UUID userId);

    /** Bộ lọc tab Nhật ký sử dụng — mọi field null = bỏ qua. */
    record EventFilter(LocalDateTime from, LocalDateTime to, UUID userId, AiTaskCode taskCode,
                       String model, AiUsageStatus status, Long minTokens, BigDecimal minCost) {

        /** Enum→String cho native query (CAST varchar, so khớp cột STRING); null giữ nguyên = bỏ qua. */
        public String taskCodeName() {
            return taskCode == null ? null : taskCode.name();
        }

        public String statusName() {
            return status == null ? null : status.name();
        }
    }
}
