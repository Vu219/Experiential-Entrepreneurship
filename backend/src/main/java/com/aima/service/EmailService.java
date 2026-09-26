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
}