package com.aima.service.Impl;

import com.aima.dto.request.*;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.dto.response.MeResponse;
import com.aima.service.EmailService;
import com.aima.service.OtpService;
import com.aima.service.RefreshTokenService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.aima.config.storage.StorageBuckets;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.UserResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapper;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.StorageService;
import com.aima.service.UserService;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {
    UserRepository userRepository;
    RoleRepository roleRepository;

    EmailService emailService;
    OtpService otpService;
    RefreshTokenService refreshTokenService;
    StorageService storageService;

    UserMapper userMapper;

    PasswordEncoder passwordEncoder;
    static int PASSWORD_CHANGE_COOLDOWN_DAYS = 7;
    static int ACCOUNT_DELETION_GRACE_DAYS = 30;

    static SecureRandom SECURE_RANDOM = new SecureRandom();
    static String GOOGLE_PLACEHOLDER = "GOOGLE_OAUTH2_USER";

    @Override
    public ApiResponse<UserResponse> registerUser(UserRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail()))
            throw new AppException(ErrorCode.EMAIL_EXISTED);

        User user = userMapper.toUser(request);
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        Role role = roleRepository.findByRoleName("USER")
                .orElseThrow(() -> new AppException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));
        user.setRole(role);

        user.setStatus(UserStatus.ACTIVE);
        user.setProfileCompleted(true);
        User savedUser = userRepository.save(user);

        UserResponse userResponse = userMapper.toResponse(savedUser);
        return ApiResponse.success("Đăng ký tài khoản thành công", userResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<UserResponse>> getAllUsers(Pageable pageable) {
        Page<User> users = userRepository.findAll(pageable);

        if (users.getTotalElements() == 0) {
            throw new AppException(ErrorCode.USER_LIST_EMPTY);
        }

        PageResponse<UserResponse> result =
                PageResponse.from(users, userMapper.toResponseList(users.getContent()));
        return ApiResponse.success("Lấy danh sách người dùng thành công", result);
    }

    @Override
    public ApiResponse<UserResponse> getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        UserResponse userResponse = userMapper.toResponse(user);
        return ApiResponse.success("Lấy thông tin Người dùng thành công", userResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<MeResponse> getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        MeResponse meResponse = userMapper.toMeResponse(user);

        // Không lộ giá trị placeholder của Google ra FE; coi như chưa có.
        if (GOOGLE_PLACEHOLDER.equals(meResponse.getPhone())) {
            meResponse.setPhone(null);
        }
        meResponse.setProfileCompleted(isProfileComplete(user));

        return ApiResponse.success("Lấy thông tin người dùng hiện tại thành công", meResponse);
    }

    @Override
    public ApiResponse<MeResponse> updateCurrentUser(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        String oldAvatarUrl = user.getAvatarUrl();

        userMapper.updateProfile(request, user);
        User saved = userRepository.save(user);

        // Đổi sang ảnh mới → xoá ảnh cũ trên Supabase để tránh file rác tích tụ trong bucket.
        if (request.getAvatarUrl() != null && !request.getAvatarUrl().equals(oldAvatarUrl)) {
            scheduleOldAvatarDeletion(oldAvatarUrl);
        }

        MeResponse meResponse = userMapper.toMeResponse(saved);
        meResponse.setProfileCompleted(isProfileComplete(saved));

        return ApiResponse.success("Cập nhật thông tin cá nhân thành công", meResponse);
    }

    private void scheduleOldAvatarDeletion(String oldAvatarUrl) {
        if (oldAvatarUrl == null) return;
        int idx = oldAvatarUrl.indexOf(StorageBuckets.AVATAR_PUBLIC_PREFIX);
        if (idx < 0) return; // không phải ảnh trong storage của ta → bỏ qua
        String path = oldAvatarUrl.substring(idx + StorageBuckets.AVATAR_PUBLIC_PREFIX.length());

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteAvatarQuietly(path);
                }
            });
        } else {
            deleteAvatarQuietly(path);
        }
    }

    private void deleteAvatarQuietly(String path) {
        try {
            storageService.deleteFile(StorageBuckets.AVATARS, path);
        } catch (Exception e) {
            log.warn("Không xoá được ảnh đại diện cũ '{}': {}", path, e.getMessage());
        }
    }

    private boolean isProfileComplete(User user) {
        if (!"GOOGLE".equalsIgnoreCase(user.getProvider())) {
            return true;
        }
        return user.getFullName() != null && !user.getFullName().isBlank()
                && user.getPhone() != null && !user.getPhone().isBlank()
                && !GOOGLE_PLACEHOLDER.equals(user.getPhone())
                && user.getDateOfBirth() != null;
    }

    @Override
    public ApiResponse<String> forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.EMAIL_NOT_FOUND));

        String otpCode = generateOtp();

        // Lưu OTP (đã hash) trong Redis kèm TTL — thay cho bảng password_reset_tokens.
        otpService.storeOtp(user.getEmail(), otpCode);
        emailService.sendForgotPasswordOtpEmail(user.getEmail(), otpCode, user.getFullName());
        return ApiResponse.success("Mã OTP đã được gửi đến email của bạn", null);
    }

    @Override
    public ApiResponse<String> verifyOtp(VerifyOtpRequest request) {
        userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.EMAIL_NOT_FOUND));

        // Ném AppException nếu OTP sai/hết hạn/vượt số lần thử.
        otpService.verifyOtp(request.getEmail(), request.getOtpCode());
        otpService.markVerified(request.getEmail());

        return ApiResponse.success("Mã OTP hợp lệ");
    }

    @Override
    @Transactional
    public ApiResponse<String> resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORDS_NOT_MATCH);
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.EMAIL_NOT_FOUND));

        // Chỉ cho đổi mật khẩu khi OTP đã được verify ở bước trước (cờ ngắn hạn trong Redis).
        if (!otpService.isVerified(request.getEmail())) {
            throw new AppException(ErrorCode.OTP_NOT_VERIFIED);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setLastPasswordChangeAt(LocalDateTime.now());
        userRepository.save(user);

        // OTP dùng một lần: xoá toàn bộ trạng thái OTP sau khi đổi thành công.
        otpService.invalidate(request.getEmail());

        // Vô hiệu hoá mọi phiên đăng nhập cũ sau khi đổi mật khẩu.
        refreshTokenService.revokeAllTokens(user.getId().toString());
        refreshTokenService.setLogoutTime(user.getEmail());

        return ApiResponse.success("Đặt lại mật khẩu thành công");
    }

    @Override
    @Transactional
    public ApiResponse<String> initChangePassword(String email, ChangePasswordInitRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        // Người dùng phải có mật khẩu hiện tại để xác minh (Google user chưa onboarding sẽ không có).
        if (user.getPassword() == null
                || !passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.PASSWORD_INCORRECT);
        }

        // Giới hạn tần suất: chỉ cho đổi mật khẩu 1 lần trong 7 ngày.
        if (user.getLastPasswordChangeAt() != null
                && user.getLastPasswordChangeAt().isAfter(
                LocalDateTime.now().minusDays(PASSWORD_CHANGE_COOLDOWN_DAYS))) {
            throw new AppException(ErrorCode.PASSWORD_CHANGE_LIMIT);
        }

        String otpCode = generateOtp();
        // Tái dùng OtpService (Redis, đã hash + TTL 90s) như luồng quên mật khẩu.
        otpService.storeOtp(user.getEmail(), otpCode);
        emailService.sendChangePasswordOtpEmail(user.getEmail(), otpCode, user.getFullName());

        return ApiResponse.success("Mã OTP đổi mật khẩu đã được gửi đến email của bạn");
    }

    @Override
    @Transactional
    public ApiResponse<String> confirmChangePassword(String email, ChangePasswordConfirmRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        // Không tin FE: xác thực lại khớp mật khẩu ở phía server (độ mạnh do @Pattern trên DTO đảm nhận).
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORDS_NOT_MATCH);
        }

        // Xác thực OTP (ném AppException nếu sai/hết hạn/vượt số lần thử).
        otpService.verifyOtp(user.getEmail(), request.getOtpCode());

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setLastPasswordChangeAt(LocalDateTime.now());
        userRepository.save(user);

        // OTP dùng một lần: xoá toàn bộ trạng thái OTP sau khi đổi thành công.
        otpService.invalidate(user.getEmail());

        return ApiResponse.success("Đổi mật khẩu thành công");
    }

    @Override
    public ApiResponse<UserResponse> completeProfile(String email, CompleteProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        if (Boolean.TRUE.equals(user.getProfileCompleted())) {
            throw new AppException(ErrorCode.PROFILE_ALREADY_COMPLETED);
        }

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORDS_NOT_MATCH);
        }

        userMapper.completeProfile(request, user);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setLastPasswordChangeAt(LocalDateTime.now());
        user.setProfileCompleted(true); // đánh dấu đã hoàn tất onboarding
        User savedUser = userRepository.save(user);

        // Confirmation email — never includes the plaintext password.
        try {
            emailService.sendAccountSetupSuccessEmail(
                    savedUser.getEmail(), savedUser.getFullName(), savedUser.getLastPasswordChangeAt());
        } catch (Exception e) {
            log.warn("Không thể gửi email xác nhận thiết lập tài khoản cho {}: {}", savedUser.getEmail(), e.getMessage());
        }

        UserResponse userResponse = userMapper.toResponse(savedUser);
        return ApiResponse.success("Đã lưu thông tin, email xác nhận đã được gửi", userResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UserResponse> getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        UserResponse userResponse = userMapper.toResponse(user);

        return ApiResponse.success("Lấy hồ sơ cá nhân thành công", userResponse);
    }

    @Override
    public ApiResponse<DeleteAccountResponse> requestDeleteAccount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        if (user.getStatus() == UserStatus.PENDING_DELETE)
            throw new AppException(ErrorCode.ACCOUNT_ALREADY_PENDING_DELETE);

        if (user.getStatus() == UserStatus.LOCKED)
            throw new AppException(ErrorCode.USER_INACTIVE);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deletionDate = now.plusDays(ACCOUNT_DELETION_GRACE_DAYS);
        user.setStatus(UserStatus.PENDING_DELETE);
        user.setDeletionDate(deletionDate);
        userRepository.save(user);

        DeleteAccountResponse deleteAccountResponse = userMapper.toDeleteAccountResponse(user,
                ChronoUnit.DAYS.between(now, deletionDate),
                "Tài khoản sẽ bị xóa vĩnh viễn sau " + ACCOUNT_DELETION_GRACE_DAYS
                        + " ngày. Bạn có thể khôi phục trước thời hạn này.");
        return ApiResponse.success("Yêu cầu xóa tài khoản đã được ghi nhận", deleteAccountResponse);
    }

    @Override
    public ApiResponse<DeleteAccountResponse> restoreAccount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        if (user.getStatus() != UserStatus.PENDING_DELETE)
            throw new AppException(ErrorCode.ACCOUNT_NOT_PENDING_DELETE);

        user.setStatus(UserStatus.ACTIVE);
        user.setDeletionDate(null);
        userRepository.save(user);

        DeleteAccountResponse deleteAccountResponse = userMapper.toDeleteAccountResponse(user, null,
                "Tài khoản của bạn đã được khôi phục và hoạt động bình thường.");
        return ApiResponse.success("Tài khoản đã được khôi phục thành công", deleteAccountResponse);
    }

    private String generateOtp() {
        int otp = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(otp);
    }
}
