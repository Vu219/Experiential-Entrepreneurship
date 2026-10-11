package com.aima.service;

import com.aima.dto.publish.PublishFailureNotice;
import com.aima.enums.Platform;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Báo người dùng khi một bài đăng thất bại CHUNG CUỘC (FR-57/FR-38/FR-76/FR-78) hoặc khi kết nối sắp hỏng.
 * Không bao giờ ghép message gốc của nền tảng / chuỗi kỹ thuật vào thông báo — câu chữ theo mã chuẩn
 * {@code PublishErrorCode} + mã tham chiếu. Lỗi cấp tài khoản (token, quyền, tài khoản bị khoá) gộp thành MỘT
 * thông báo / tài khoản / mã / ngày, kèm email nếu bật {@code aima.notifications.publish-email-enabled}.
 * Best-effort: lỗi chỉ log. Không báo khi bài còn đang được tự thử lại.
 */
public interface PublishFailureNotifier {

    /**
     * Gọi SAU khi kết quả thất bại đã commit (và sau khi tạm giữ lịch của tài khoản, nếu có).
     *
     * @param heldSchedules số lịch chờ của tài khoản vừa bị chuyển ON_HOLD (0 nếu không)
     */
    void notifyFailure(PublishFailureNotice notice, int heldSchedules);

    /**
     * Token sắp hết hạn mà tự làm mới thất bại ({@code TokenHealthCheckJob}) — nhắc kết nối lại TRƯỚC khi bài đăng
     * bị lỗi. Một lần cho mỗi (kết nối, ngày hết hạn).
     */
    void notifyTokenExpiring(UUID userId, UUID accountId, String accountName, Platform platform, LocalDateTime expiresAt);
}
