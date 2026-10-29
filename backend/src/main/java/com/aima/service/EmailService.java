package com.aima.service;

import java.time.LocalDateTime;

public interface EmailService {
    void sendForgotPasswordOtpEmail(String toEmail, String otpCode, String fullName);
    void sendChangePasswordOtpEmail(String toEmail, String otpCode, String fullName);
    /** OTP xác thực email khi đăng ký tài khoản email/mật khẩu. */
    void sendRegisterOtpEmail(String toEmail, String otpCode, String fullName, long validMinutes);
    void sendAccountSetupSuccessEmail(String toEmail, String fullName, LocalDateTime setupTime);
    /** Cảnh báo tài khoản còn `daysRemaining` ngày trước khi bị xóa vĩnh viễn (FR-80). */
    void sendAccountDeletionWarningEmail(String toEmail, String fullName, LocalDateTime deletionDate, long daysRemaining);
    /**
     * Một kết nối mạng xã hội cần người dùng xử lý (token hết hạn / sắp hết hạn, thiếu quyền, tài khoản bị chặn) —
     * bài đăng của tài khoản đó đang/sẽ thất bại. {@code actionPath} là đường dẫn FE (vd "/settings?tab=connections").
     * Nội dung là câu đã soạn sẵn (không message gốc của nền tảng); được escape HTML khi dựng email.
     */
    void sendPublishActionRequiredEmail(String toEmail, String fullName, String title, String message,
                                        String actionLabel, String actionPath, String unsubscribeToken);
    /** Biên lai sau khi đơn mua gói đã thu tiền và gói đã kích hoạt (G1.2 — xác nhận đơn cho khách). */
    void sendPaymentReceiptEmail(String toEmail, String fullName, String invoiceNo, String planName, long amount,
                                 LocalDateTime paidAt, LocalDateTime planExpiresAt);
}