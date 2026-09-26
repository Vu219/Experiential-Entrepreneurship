package com.aima.service;

import com.aima.dto.request.RegisterResendOtpRequest;
import com.aima.dto.request.RegisterVerifyRequest;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.RegisterOtpResponse;
import com.aima.dto.response.UserResponse;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Đăng ký email/mật khẩu 2 bước: gửi OTP về email → chỉ tạo tài khoản khi OTP đúng.
 * Thông tin chờ xác thực + OTP nằm trong Redis (không tạo dòng users trước khi xác thực).
 */
public interface RegistrationService {
    /** Bước 1: email chưa tồn tại → lưu thông tin chờ + gửi OTP. Email đã tồn tại → EMAIL_EXISTED. */
    ApiResponse<RegisterOtpResponse> startRegistration(UserRegisterRequest request);

    /** Gửi lại OTP (có thời gian chờ tối thiểu giữa các lần gửi). */
    ApiResponse<RegisterOtpResponse> resendOtp(RegisterResendOtpRequest request);

    /** Bước 2: OTP đúng → tạo tài khoản + set cookie đăng nhập. */
    ApiResponse<UserResponse> verifyRegistration(RegisterVerifyRequest request, HttpServletResponse response);
}
