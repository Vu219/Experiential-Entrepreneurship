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
import org.springframework.data.domain.PageRequest;
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
import com.aima.dto.response.UserStatsResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.StorageService;
import com.aima.service.UserService;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {
    UserRepository userRepository;
    RoleRepository roleRepository;
    PlatformAccountRepository platformAccountRepository;

    EmailService emailService;
    OtpService otpService;
    RefreshTokenService refreshTokenService;
    StorageService storageService;

    UserMapper userMapper;
    ActivityLogService activityLogService;

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

        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.ACCOUNT_REGISTERED, savedUser.getId(), savedUser.getEmail()));
        UserResponse userResponse = userMapper.toResponse(savedUser);
        return ApiResponse.success("Đăng ký tài khoản thành công", userResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<UserResponse>> getAllUsers(String q, UserStatus status, String role, UserPlan plan, Pageable pageable) {
        // FR-80: tìm theo tên/email + lọc trạng thái/vai trò/gói; ORDER BY nằm trong native query
        // nên Pageable không mang Sort riêng (cùng mẫu ContentItemServiceImpl.list).
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<User> users = userRepository.search(
                q == null ? "" : q.trim(),
                status == null ? null : status.name(),
                (role == null || role.isBlank()) ? null : role.trim().toUpperCase(),
                plan == null ? null : plan.name(),
                unsorted);

        if (users.getTotalElements() == 0) {
            throw new AppException(ErrorCode.USER_LIST_EMPTY);
        }

        PageResponse<UserResponse> result =
                PageResponse.from(users, userMapper.toResponseList(users.getContent()));
        return ApiResponse.success("Lấy danh sách người dùng thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UserStatsResponse> getUserStats() {
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        UserStatsResponse stats = UserStatsResponse.builder()
                .total(userRepository.countByDeletedAtIsNull())
                .active(userRepository.countByStatusAndDeletedAtIsNull(UserStatus.ACTIVE))
                .locked(userRepository.countByStatusAndDeletedAtIsNull(UserStatus.LOCKED))
                .newThisMonth(userRepository.countByCreatedAtGreaterThanEqualAndDeletedAtIsNull(startOfMonth))
                .build();
        return ApiResponse.success("Lấy số liệu người dùng thành công", stats);
    }

    // FR-80: admin tạo tài khoản thủ công — mật khẩu do admin đặt, mặc định role USER + gói FREE.
    @Override
    public ApiResponse<UserResponse> createUser(String adminEmail, AdminCreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        User user = userMapper.toUser(request);
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        String roleName = "ADMIN".equalsIgnoreCase(request.getRole()) ? "ADMIN" : "USER";
        Role role = roleRepository.findByRoleName(roleName)
                .orElseThrow(() -> new AppException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));
        user.setRole(role);

        if (user.getPlan() == null) user.setPlan(UserPlan.FREE);
        user.setStatus(UserStatus.ACTIVE);
        user.setProfileCompleted(true);
        User saved = userRepository.save(user);

        log.info("[Admin] {} tạo tài khoản {} (role={}, plan={})", adminEmail, saved.getEmail(), roleName, saved.getPlan());

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_CREATED, adminEmail, "User", saved.getId().toString(),
                Map.of("email", saved.getEmail(), "role", String.valueOf(roleName),
                        "plan", String.valueOf(saved.getPlan()))));
        UserResponse response = userMapper.toResponse(saved);
        return ApiResponse.success("Tạo tài khoản thành công", response);
    }

    // FR-80: admin cập nhật hồ sơ/gói/vai trò/trạng thái (partial). Guard chống tự hạ vai trò/tự khoá-xoá
    // chính mình + khoá đổi email cho tài khoản Google. Ghi audit log (ai, gì, khi nào).
    @Override
    public ApiResponse<UserResponse> updateUser(String adminEmail, UUID userId, AdminUpdateUserRequest request) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        boolean isSelf = user.getId().equals(admin.getId());
        if (isSelf && request.getRole() != null && !"ADMIN".equalsIgnoreCase(request.getRole())) {
            throw new AppException(ErrorCode.ADMIN_CANNOT_DEMOTE_SELF);
        }
        if (isSelf && request.getStatus() != null && request.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(ErrorCode.DELETE_SELF_INVALID);
        }
        // SEC-05: tài khoản ADMIN được bảo vệ khỏi khoá/chờ-xoá — nhất quán với PATCH /users/{id}/status.
        boolean targetIsAdmin = user.getRole() != null && "ADMIN".equals(user.getRole().getRoleName());
        if (targetIsAdmin && request.getStatus() != null && request.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(ErrorCode.ADMIN_PROTECTED);
        }

        boolean isGoogle = "GOOGLE".equalsIgnoreCase(user.getProvider());
        if (request.getEmail() != null && !request.getEmail().equalsIgnoreCase(user.getEmail())) {
            if (isGoogle) throw new AppException(ErrorCode.EMAIL_LOCKED_FOR_GOOGLE);
            if (userRepository.existsByEmail(request.getEmail())) throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        String oldAvatarUrl = user.getAvatarUrl();
        userMapper.updateByAdmin(request, user);

        // Vai trò do service tra cứu entity — chỉ đổi khi admin gửi và khác hiện tại.
        if (request.getRole() != null) {
            String roleName = "ADMIN".equalsIgnoreCase(request.getRole()) ? "ADMIN" : "USER";
            if (user.getRole() == null || !roleName.equals(user.getRole().getRoleName())) {
                Role role = roleRepository.findByRoleName(roleName)
                        .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
                user.setRole(role);
            }
        }

        User saved = userRepository.save(user);

        // Đổi avatar → xoá ảnh cũ trên Supabase (sau commit, không phá luồng nếu lỗi).
        if (request.getAvatarUrl() != null && !request.getAvatarUrl().equals(oldAvatarUrl)) {
            scheduleOldAvatarDeletion(oldAvatarUrl);
        }

        log.info("[Admin] {} cập nhật user {} [{}]", adminEmail, userId, describeChanges(request));

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_UPDATED, adminEmail, "User", userId.toString(),
                Map.of("email", saved.getEmail(), "changes", describeChanges(request))));
        UserResponse response = userMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật tài khoản thành công", response);
    }

    // FR-80: admin kích hoạt đặt lại mật khẩu — tái dùng luồng OTP quên mật khẩu (gửi tới email user).
    @Override
    public ApiResponse<String> resetUserPassword(String adminEmail, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        if ("GOOGLE".equalsIgnoreCase(user.getProvider())) {
            throw new AppException(ErrorCode.GOOGLE_NO_PASSWORD);
        }

        String otpCode = generateOtp();
        otpService.storeOtp(user.getEmail(), otpCode);
        emailService.sendForgotPasswordOtpEmail(user.getEmail(), otpCode, user.getFullName());

        log.info("[Admin] {} kích hoạt đặt lại mật khẩu cho user {} ({})", adminEmail, userId, user.getEmail());
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_PASSWORD_RESET, adminEmail, "User", userId.toString(),
                Map.of("email", user.getEmail())));
        return ApiResponse.success("Đã gửi email đặt lại mật khẩu");
    }

    // FR-80: admin xóa CỨNG tài khoản (khác xóa mềm). Cascade toàn bộ dữ liệu liên quan qua JPA
    // (User → brandProfiles/platformAccounts/notifications → content/version/schedule/post/analytics/job…).
    // Áp dụng được cho cả tài khoản đang PENDING_DELETE (admin xóa luôn không cần đợi hết 30 ngày).
    @Override
    public ApiResponse<String> deleteUser(String adminEmail, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        // Tài khoản ADMIN được bảo vệ (cũng chặn admin tự xóa chính mình vì self luôn là ADMIN).
        if (user.getRole() != null && "ADMIN".equals(user.getRole().getRoleName())) {
            throw new AppException(ErrorCode.ADMIN_PROTECTED);
        }

        String email = user.getEmail();
        userRepository.delete(user);
        log.info("[Admin] {} XÓA CỨNG tài khoản {} ({}) + toàn bộ dữ liệu liên quan", adminEmail, userId, email);
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_DELETED, adminEmail, "User", userId.toString(),
                Map.of("email", email)));
        return ApiResponse.success("Đã xóa tài khoản và toàn bộ dữ liệu liên quan");
    }

    // Ghi audit: liệt kê các trường được admin thay đổi (giá trị nhạy cảm không log).
    private String describeChanges(AdminUpdateUserRequest r) {
        List<String> f = new ArrayList<>();
        if (r.getFullName() != null) f.add("fullName");
        if (r.getEmail() != null) f.add("email");
        if (r.getPhone() != null) f.add("phone");
        if (r.getAvatarUrl() != null) f.add("avatarUrl");
        if (r.getRole() != null) f.add("role=" + r.getRole());
        if (r.getPlan() != null) f.add("plan=" + r.getPlan());
        if (r.getStatus() != null) f.add("status=" + r.getStatus());
        return String.join(", ", f);
    }

    // FR-80: admin khóa/mở khóa — chỉ đổi qua lại ACTIVE/LOCKED; tài khoản ADMIN được bảo vệ (SEC-05).
    @Override
    public ApiResponse<UserResponse> updateUserStatus(String adminEmail, UUID userId, UserStatusUpdateRequest request) {
        if (request.getStatus() != UserStatus.ACTIVE && request.getStatus() != UserStatus.LOCKED) {
            throw new AppException(ErrorCode.INVALID_USER_STATUS);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        if (user.getRole() != null && "ADMIN".equals(user.getRole().getRoleName())) {
            throw new AppException(ErrorCode.ADMIN_PROTECTED);
        }

        user.setStatus(request.getStatus());
        User saved = userRepository.save(user);
        log.info("[Admin] {} đổi trạng thái user {} thành {}", adminEmail, userId, request.getStatus());

        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.USER_STATUS_CHANGED, adminEmail, "User", userId.toString(),
                Map.of("email", saved.getEmail(), "status", request.getStatus().name())));
        UserResponse response = userMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật trạng thái tài khoản thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<UserResponse> getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        UserResponse userResponse = userMapper.toResponse(user);
        // Số kênh MXH đã kết nối — trường suy diễn không có trên entity (cùng mẫu setProfileCompleted).
        userResponse.setConnectedChannels((int) platformAccountRepository.countByUser_IdAndDeletedAtIsNull(userId));
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

        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.PROFILE_UPDATED, saved.getId(), saved.getEmail()));
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

        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.PASSWORD_RESET, user.getId(), user.getEmail()));
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

        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.PASSWORD_CHANGED, user.getId(), user.getEmail()));
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
        user.setDeletionWarningSentAt(null); // yêu cầu mới → reset cờ cảnh báo 7 ngày
        userRepository.save(user);

        DeleteAccountResponse deleteAccountResponse = userMapper.toDeleteAccountResponse(user,
                ChronoUnit.DAYS.between(now, deletionDate),
                "Tài khoản sẽ bị xóa vĩnh viễn sau " + ACCOUNT_DELETION_GRACE_DAYS
                        + " ngày. Bạn có thể khôi phục trước thời hạn này.");
        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.ACCOUNT_DELETE_REQUESTED, user.getId(), user.getEmail()));
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
        user.setDeletionWarningSentAt(null); // khôi phục → xoá cờ cảnh báo để lần xóa sau lại cảnh báo
        userRepository.save(user);

        DeleteAccountResponse deleteAccountResponse = userMapper.toDeleteAccountResponse(user, null,
                "Tài khoản của bạn đã được khôi phục và hoạt động bình thường.");
        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.ACCOUNT_RESTORED, user.getId(), user.getEmail()));
        return ApiResponse.success("Tài khoản đã được khôi phục thành công", deleteAccountResponse);
    }

    private String generateOtp() {
        int otp = 100000 + SECURE_RANDOM.nextInt(900000);
        return String.valueOf(otp);
    }
}
