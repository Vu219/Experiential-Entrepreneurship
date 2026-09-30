package com.aima.service;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;

import com.aima.dto.request.ScheduleBatchRequest;
import com.aima.dto.response.ScheduleBatchResponse;
import com.aima.dto.response.SuggestedSlotResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PostScheduleService {

    /** Tạo MỘT lịch (mode SCHEDULE/NOW); idempotencyKey (header, tuỳ chọn) dùng chung quy tắc với batch. */
    ApiResponse<PostScheduleResponse> create(String email, PostScheduleRequest request, String idempotencyKey);

    /** Nhiều dòng, mỗi dòng một transaction độc lập + key idempotency riêng; kết quả theo dòng. */
    ApiResponse<ScheduleBatchResponse> createBatch(String email, ScheduleBatchRequest request);

    /** Đăng ngay một lịch SCHEDULED (hoặc ON_HOLD đã hết lý do): server gán giờ hiện tại, tạo job, trả job ngay. */
    ApiResponse<PostScheduleResponse> publishNow(String email, UUID scheduleId, String idempotencyKey);

    /** Khung giờ vàng còn trống của một tài khoản (không tạo lịch, không giữ chỗ). */
    ApiResponse<List<SuggestedSlotResponse>> suggestSlots(String email, UUID accountId, Instant from, Integer count);

    ApiResponse<List<PostScheduleResponse>> list(String email, ScheduleStatus status, Platform platform);

    ApiResponse<PostScheduleResponse> get(String email, UUID scheduleId);

    ApiResponse<PostScheduleResponse> update(String email, UUID scheduleId, PostScheduleUpdateRequest request);

    ApiResponse<PostScheduleResponse> cancel(String email, UUID scheduleId);

    ApiResponse<GoldenHourResponse> suggestGoldenHours(Platform platform);

    // ---- Nội bộ (không trả ApiResponse) — vòng đời tài khoản chờ xoá ----

    /**
     * User yêu cầu xoá tài khoản: mọi lịch SCHEDULED → ON_HOLD, và các bài đang chờ retry/chờ chạy
     * bị huỷ job + lịch về ON_HOLD để KHÔNG tự đăng tiếp. Trả số lịch bị tạm giữ.
     */
    int holdAllForPendingDeletion(UUID userId);

    /** Số lịch ON_HOLD của user — báo lại khi user khôi phục tài khoản để tự kích hoạt lại. */
    int countOnHold(UUID userId);

    /** Khôi phục tài khoản: gỡ USER_PENDING_DELETE; lịch vẫn ON_HOLD tới khi user tự kích hoạt lại. */
    int releasePendingDeletionHolds(UUID userId);
}
