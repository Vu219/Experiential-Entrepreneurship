package com.aima.service;

import com.aima.dto.publish.PublishFailureFacts;
import com.aima.entity.Post;
import com.aima.entity.PostSchedule;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.HoldReason;

import java.util.UUID;

/**
 * Hồi phục bài đăng lỗi — DÙNG CHUNG cho trang "Bài lỗi & cần xử lý" của user và thao tác "thử lại thay người
 * dùng" của admin (docs/failed-posts-error-handling-plan.md §3.4). Không kiểm quyền sở hữu: caller đã chặn.
 */
public interface PublishRecoveryService {

    /** Kết quả "Thử lại ngay": job mới đã giao worker, hoặc lý do lịch bị tạm giữ thay vì đăng. */
    record RetryOutcome(UUID postId, UUID scheduleId, UUID jobId, HoldReason heldReason) {
    }

    /**
     * Suy ra mã chuẩn, vòng đời, lượt thử và hành động khả dụng của một bài lỗi. Gọi TRONG transaction
     * (đọc job/kết quả/lịch/tài khoản lazy).
     */
    PublishFailureFacts describe(Post post);

    /** Job FAILED muộn nhất của bài (lần lỗi đang hiển thị); null nếu chưa có. */
    PostingJob lastFailedJob(Post post);

    /** publish_result thất bại muộn nhất (mã/message gốc cho dòng cũ trước V13); null nếu chưa có. */
    PublishResult lastErrorResult(Post post);

    /**
     * "Thử lại ngay" (FR-58): lịch FAILED → SCHEDULED ngay → dispatch như "Đăng ngay"; worker được giao SAU commit.
     * Chặn khi tài khoản chưa sẵn sàng, khi lỗi nội dung mà nội dung chưa được sửa, khi lỗi không thể khắc phục
     * bằng thử lại. Đánh dấu lần lỗi cũ {@code RETRIED}.
     *
     * @param actorId người bấm (chủ bài hoặc admin) — lưu ở {@code posting_jobs.resolved_by}
     */
    RetryOutcome retry(UUID postId, UUID actorId);

    /** Bỏ qua lỗi cuối của bài (ẩn khỏi "Cần xử lý"); gọi lặp = no-op. */
    void dismiss(UUID postId, UUID actorId);

    /**
     * Lịch FAILED sắp bị huỷ ({@code DELETE /schedules/{id}}) → đánh dấu lần lỗi cuối {@code CANCELLED}. Gọi trong
     * transaction của luồng huỷ, TRƯỚC khi đổi trạng thái lịch.
     */
    void markCancelled(PostSchedule schedule, UUID actorId);
}
