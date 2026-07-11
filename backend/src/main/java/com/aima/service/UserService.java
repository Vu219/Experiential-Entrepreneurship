package com.aima.service;

import com.aima.dto.request.*;
import com.aima.dto.response.ApiResponse;
import com.aima.enums.UserStatus;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.dto.response.MeResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.UserResponse;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface UserService {
    ApiResponse<UserResponse> registerUser(UserRegisterRequest request);
    ApiResponse<PageResponse<UserResponse>> getAllUsers(String q, UserStatus status, Pageable pageable);
    ApiResponse<UserResponse> getUserById(UUID userId);
    /** FR-80: admin khóa/mở khóa tài khoản; không áp dụng lên tài khoản ADMIN. */
    ApiResponse<UserResponse> updateUserStatus(String adminEmail, UUID userId, UserStatusUpdateRequest request);
    ApiResponse<MeResponse> getCurrentUser(String email);
    ApiResponse<MeResponse> updateCurrentUser(String email, UpdateProfileRequest request);

    ApiResponse<String> forgotPassword(ForgotPasswordRequest request);
    ApiResponse<String> verifyOtp(VerifyOtpRequest request);
    ApiResponse<String> resetPassword(ResetPasswordRequest request);
    ApiResponse<String> initChangePassword(String email, ChangePasswordInitRequest request);
    ApiResponse<String> confirmChangePassword(String email, ChangePasswordConfirmRequest request);

    ApiResponse<UserResponse> completeProfile(String email, CompleteProfileRequest request);
    ApiResponse<UserResponse> getMyProfile(String email);

    //delete
    ApiResponse<DeleteAccountResponse> requestDeleteAccount(String email);
    ApiResponse<DeleteAccountResponse> restoreAccount(String email);
}
