package com.aima.service;

import com.aima.enums.RealtimeJobKind;
import com.aima.enums.Platform;
import com.aima.entity.PostSchedule;
import java.util.UUID;

/**
 * Hệ quả phía người dùng khi một tác vụ nền đổi trạng thái — MỘT chỗ cho thông báo + sự kiện realtime
 * ({@code job.updated}) của job AI, thay vì rải ở từng worker / job vớt. Gọi TRONG transaction của nơi đổi trạng thái
 * (đọc entity lazy); thông báo / sự kiện tự phát sau commit. Best-effort: không bao giờ ném ra.
 */
public interface JobEventService {

    /** Job tạo nội dung vừa chốt FAILED (worker lỗi hoặc job vớt chốt AI_TIMEOUT). Huỷ bởi user thì không báo. */
    void generationFailed(UUID jobId);

    /** Phiên nghiên cứu xu hướng vừa COMPLETED / FAILED (FAILED của phiên tự động xếp hàng thì không báo). */
    void researchFinished(UUID sessionId);

    /**
     * {@code job.updated} cho job tạo nội dung theo trạng thái hiện tại của job (đọc DB).
     *
     * @param stage mốc trong lúc chạy: QUEUED / PREPARING / GENERATING (null với trạng thái cuối)
     */
    void generationUpdated(UUID jobId, String stage);

    /** {@code job.updated} chung (định dạng, tạo lại, nghiên cứu, AI hỗ trợ, tối ưu chiến lược) — dữ liệu do caller đưa. */
    void jobUpdated(UUID userId, RealtimeJobKind kind, UUID jobId, String status, UUID itemId, Platform platform,
                    String errorCode);

    /** Tiến độ job định dạng: xong {@code done}/{@code total} nền tảng (vừa xong {@code platform}). */
    void formattingProgress(UUID userId, UUID jobId, UUID itemId, int done, int total, Platform platform);

    /** {@code post.updated} theo trạng thái hiện tại của lịch (gọi trong transaction đã đổi lịch/bài/job). */
    void postUpdated(PostSchedule schedule);
}
