package com.aima.service;

import com.aima.dto.response.ActivityLogResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi & đọc log hoạt động nghiệp vụ ({@code activity_logs}) — nguồn cho tab
 * "Log hoạt động người dùng". KHÁC {@link SystemLogService} (log LỖI kỹ thuật): bảng riêng,
 * retention riêng, không trộn lẫn.
 *
 * <p><b>Ghi là best-effort và BẤT ĐỒNG BỘ:</b> {@link #record(Entry)} chỉ chụp IP/User-Agent
 * của request hiện tại rồi trả về ngay; phần dedup + ghi DB chạy trên
 * {@code activityLogExecutor} qua {@link ActivityLogWriter}. Lỗi khi ghi log bị NUỐT và đẩy
 * sang {@link SystemLogService#error} — không bao giờ làm hỏng request nghiệp vụ.
 */
public interface ActivityLogService {

    /**
     * Ghi một hành động. Gọi được từ bất kỳ đâu trong luồng request; ngoài request context
     * (scheduler/worker) thì IP/User-Agent là null.
     */
    void record(Entry entry);

    /** GET /admin/logs/activity — lọc + phân trang server-side (offset, mới nhất trước). */
    ApiResponse<PageResponse<ActivityLogResponse>> list(Filter filter, int page, int size);

    /** GET /admin/logs/activity/{id} — panel chi tiết (metadata đầy đủ). */
    ApiResponse<ActivityLogResponse> get(UUID id);

    /**
     * GET /admin/logs/activity/export — CSV (chuỗi trong result, FE tự tạo file) theo ĐÚNG bộ
     * lọc đang chọn. Vượt trần 50.000 dòng → ACTIVITY_LOG_EXPORT_TOO_LARGE, không cắt cụt im lặng
     * (cùng quy ước với export nhật ký usage).
     */
    ApiResponse<String> exportCsv(String actorEmail, Filter filter);

    /**
     * Bộ lọc tab hoạt động — mọi field null = bỏ qua. {@code from}/{@code to} là NGÀY theo
     * múi giờ ứng dụng ({@code APP_TIMEZONE}); {@code to} được hiểu là BAO GỒM cả ngày đó.
     */
    record Filter(LocalDate from, LocalDate to, UUID userId, ActivityAction action,
                  ActivityResult result, String q) {

        /** Enum→String cho native query (CAST varchar); null giữ nguyên = bỏ qua. */
        public String actionName() {
            return action == null ? null : action.name();
        }

        public String resultName() {
            return result == null ? null : result.name();
        }
    }

    /**
     * Một hành động cần ghi. Cố tình CHỈ chứa giá trị vô hướng (không entity): việc ghi chạy
     * trên thread khác, mang entity sang sẽ dính LazyInitializationException.
     *
     * @param userId    có thể null — khi đó writer tự tra theo {@code userEmail} trên thread nền
     * @param userEmail email chốt lúc ghi — log còn đọc được sau khi user bị xoá
     * @param targetId  định danh đối tượng bị tác động; null nếu hành động không có đối tượng
     * @param metadata  ngữ cảnh bổ sung, được serialize sang JSON và CẮT nếu quá dài
     */
    record Entry(ActivityAction action, UUID userId, String userEmail, String targetType,
                 String targetId, ActivityResult result, Map<String, Object> metadata) {

        /** Hành động thành công, không gắn đối tượng (vd LOGIN, LOGOUT). */
        public static Entry of(ActivityAction action, UUID userId, String userEmail) {
            return new Entry(action, userId, userEmail, null, null, ActivityResult.SUCCESS, null);
        }

        /** Hành động thành công trên một đối tượng cụ thể. */
        public static Entry of(ActivityAction action, UUID userId, String userEmail,
                               String targetType, String targetId) {
            return new Entry(action, userId, userEmail, targetType, targetId,
                    ActivityResult.SUCCESS, null);
        }

        /**
         * Hành động của người thao tác mà call site chỉ cầm EMAIL (vd {@code principal.getUsername()}
         * ở các endpoint admin) — writer tự tra userId.
         */
        public static Entry byActor(ActivityAction action, String actorEmail,
                                    String targetType, String targetId, Map<String, Object> metadata) {
            return new Entry(action, null, actorEmail, targetType, targetId,
                    ActivityResult.SUCCESS, metadata);
        }

        /** Hành động thất bại — {@code reason} vào metadata để hiện ở panel chi tiết. */
        public static Entry failed(ActivityAction action, UUID userId, String userEmail, String reason) {
            return new Entry(action, userId, userEmail, null, null, ActivityResult.FAILURE,
                    reason == null ? null : Map.of("reason", reason));
        }

        public Entry withMetadata(Map<String, Object> value) {
            return new Entry(action, userId, userEmail, targetType, targetId, result, value);
        }
    }
}
