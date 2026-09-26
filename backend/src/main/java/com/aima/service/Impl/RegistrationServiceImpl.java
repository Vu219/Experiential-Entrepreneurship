package com.aima.service.Impl;

import com.aima.dto.request.RegisterResendOtpRequest;
import com.aima.dto.request.RegisterVerifyRequest;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.RegisterOtpResponse;
import com.aima.dto.response.UserResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapper;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.security.CookieUtils;
import com.aima.service.ActivityLogService;
import com.aima.service.AuthenticationService;
import com.aima.service.EmailService;
import com.aima.service.RegistrationService;
import com.aima.util.EmailNormalizer;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class RegistrationServiceImpl implements RegistrationService {

    // Key riêng cho đăng ký — tách khỏi pwd_otp:* của quên/đổi mật khẩu.
    static String PENDING_PREFIX = "reg_pending:";       // hash: fullName, password (BCrypt), phone
    static String OTP_PREFIX = "reg_otp:";               // BCrypt của mã OTP hiện hành
    static String ATTEMPT_PREFIX = "reg_otp_attempt:";   // số lần nhập sai của mã hiện hành
    static String COOLDOWN_PREFIX = "reg_otp_cooldown:"; // chặn spam gửi lại

    static String F_FULL_NAME = "fullName";
    static String F_PASSWORD = "password";
    static String F_PHONE = "phone";

    static SecureRandom SECURE_RANDOM = new SecureRandom();

    StringRedisTemplate redis;
    PasswordEncoder passwordEncoder;
    UserRepository userRepository;
    RoleRepository roleRepository;
    UserMapper userMapper;
    EmailService emailService;
    AuthenticationService authenticationService;
    CookieUtils cookieUtils;
    ActivityLogService activityLogService;

    @NonFinal
    @Value("${otp.register.ttl-seconds:300}")
    long otpTtlSeconds;

    @NonFinal
    @Value("${otp.register.max-attempts:5}")
    long maxAttempts;

    @NonFinal
    @Value("${otp.register.resend-cooldown-seconds:60}")
    long resendCooldownSeconds;

    @NonFinal
    @Value("${otp.register.pending-ttl-seconds:1800}")
    long pendingTtlSeconds;

    @Override
    public ApiResponse<RegisterOtpResponse> startRegistration(UserRegisterRequest request) {
        String email = EmailNormalizer.normalize(request.getEmail());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        // Chặn spam trước khi ghi đè thông tin chờ của lần đăng ký trước.
        acquireCooldown(email);

        // Thông tin chờ xác thực: mật khẩu lưu dạng BCrypt, không bao giờ plain text (SEC-01).
        String pendingKey = PENDING_PREFIX + email;
        redis.delete(pendingKey);
        redis.opsForHash().putAll(pendingKey, pendingFields(request));
        redis.expire(pendingKey, Duration.ofSeconds(pendingTtlSeconds));

        sendOtp(email, request.getFullName());
        RegisterOtpResponse result = otpResponse(email);
        return ApiResponse.success("Mã OTP đã được gửi đến email của bạn", result);
    }

    @Override
    public ApiResponse<RegisterOtpResponse> resendOtp(RegisterResendOtpRequest request) {
        String email = EmailNormalizer.normalize(request.getEmail());
        Object fullName = redis.opsForHash().get(PENDING_PREFIX + email, F_FULL_NAME);
        if (fullName == null) {
            throw new AppException(ErrorCode.REGISTRATION_SESSION_EXPIRED);
        }

        acquireCooldown(email);
        sendOtp(email, fullName.toString());
        redis.expire(PENDING_PREFIX + email, Duration.ofSeconds(pendingTtlSeconds));
        RegisterOtpResponse result = otpResponse(email);
        return ApiResponse.success("Đã gửi lại mã OTP đến email của bạn", result);
    }

    @Override
    @Transactional
    public ApiResponse<UserResponse> verifyRegistration(RegisterVerifyRequest request, HttpServletResponse response) {
        String email = EmailNormalizer.normalize(request.getEmail());
        Map<Object, Object> pending = redis.opsForHash().entries(PENDING_PREFIX + email);
        if (pending.isEmpty()) {
            throw new AppException(ErrorCode.REGISTRATION_SESSION_EXPIRED);
        }

        verifyOtp(email, request.getOtpCode());

        // Email có thể vừa bị chiếm trong lúc chờ OTP (vd đăng nhập Google) → không tạo trùng.
        if (userRepository.existsByEmailIgnoreCase(email)) {
            clearAll(email);
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        User saved;
        try {
            saved = userRepository.saveAndFlush(buildUser(email, pending));
        } catch (DataIntegrityViolationException e) {
            clearAll(email);
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }
        clearAll(email);

        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.ACCOUNT_REGISTERED, saved.getId(), saved.getEmail()));
        log.info("Tạo tài khoản mới sau xác thực OTP: {}", email);

        // Đăng nhập luôn: cùng cặp cookie HttpOnly như POST /auth/login.
        var tokens = authenticationService.generateTokenForOAuth2User(saved);
        cookieUtils.addAccessTokenCookie(response, tokens.getToken());
        cookieUtils.addRefreshTokenCookie(response, tokens.getRefreshToken());

        UserResponse userResponse = userMapper.toResponse(saved);
        return ApiResponse.success("Đăng ký tài khoản thành công", userResponse);
    }

    private void acquireCooldown(String email) {
        Boolean acquired = redis.opsForValue()
                .setIfAbsent(COOLDOWN_PREFIX + email, "1", Duration.ofSeconds(resendCooldownSeconds));
        if (!Boolean.TRUE.equals(acquired)) {
            throw new AppException(ErrorCode.OTP_RESEND_TOO_SOON);
        }
    }

    private void sendOtp(String email, String fullName) {
        String otpCode = String.valueOf(100000 + SECURE_RANDOM.nextInt(900000));
        // Mã mới thay mã cũ (mã cũ vô hiệu ngay) + reset bộ đếm sai.
        redis.opsForValue().set(OTP_PREFIX + email, passwordEncoder.encode(otpCode), Duration.ofSeconds(otpTtlSeconds));
        redis.delete(ATTEMPT_PREFIX + email);

        try {
            emailService.sendRegisterOtpEmail(email, otpCode, fullName, otpTtlSeconds / 60);
        } catch (RuntimeException e) {
            // Gửi thất bại → gỡ mã + thời gian chờ để người dùng thử lại ngay.
            redis.delete(List.of(OTP_PREFIX + email, COOLDOWN_PREFIX + email));
            throw e;
        }
    }

    private void verifyOtp(String email, String otpCode) {
        String otpKey = OTP_PREFIX + email;
        String hash = redis.opsForValue().get(otpKey);
        if (hash == null) {
            throw new AppException(ErrorCode.OTP_NOT_FOUND);
        }

        if (!passwordEncoder.matches(otpCode, hash)) {
            String attemptKey = ATTEMPT_PREFIX + email;
            Long attempts = redis.opsForValue().increment(attemptKey);
            if (attempts != null && attempts == 1L) {
                redis.expire(attemptKey, Duration.ofSeconds(otpTtlSeconds));
            }
            if (attempts != null && attempts >= maxAttempts) {
                // Đốt mã để chặn brute-force; thông tin đăng ký vẫn giữ để gửi lại mã mới.
                redis.delete(List.of(otpKey, attemptKey));
                throw new AppException(ErrorCode.OTP_ATTEMPTS_EXCEEDED);
            }
            throw new AppException(ErrorCode.REGISTER_OTP_INCORRECT);
        }

        // Dùng 1 lần: chỉ request xoá được key mới đi tiếp (chặn 2 request song song cùng mã).
        if (!Boolean.TRUE.equals(redis.delete(otpKey))) {
            throw new AppException(ErrorCode.OTP_NOT_FOUND);
        }
    }

    private Map<String, String> pendingFields(UserRegisterRequest request) {
        Map<String, String> fields = new HashMap<>();
        fields.put(F_FULL_NAME, request.getFullName().trim());
        fields.put(F_PASSWORD, passwordEncoder.encode(request.getPassword()));
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            fields.put(F_PHONE, request.getPhone());
        }
        return fields;
    }

    private User buildUser(String email, Map<Object, Object> pending) {
        Role role = roleRepository.findByRoleName("USER")
                .orElseThrow(() -> new AppException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));
        Object phone = pending.get(F_PHONE);
        User user = userMapper.toUser(email, pending.get(F_FULL_NAME).toString(),
                pending.get(F_PASSWORD).toString(), phone == null ? null : phone.toString());
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setProfileCompleted(true);
        return user;
    }

    private RegisterOtpResponse otpResponse(String email) {
        return new RegisterOtpResponse(email, otpTtlSeconds, resendCooldownSeconds);
    }

    private void clearAll(String email) {
        redis.delete(List.of(PENDING_PREFIX + email, OTP_PREFIX + email,
                ATTEMPT_PREFIX + email, COOLDOWN_PREFIX + email));
    }
}
