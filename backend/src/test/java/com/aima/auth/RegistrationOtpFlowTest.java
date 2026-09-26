package com.aima.auth;

import com.aima.dto.request.RegisterResendOtpRequest;
import com.aima.dto.request.RegisterVerifyRequest;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.AuthenticationResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapperImpl;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.security.CookieUtils;
import com.aima.service.ActivityLogService;
import com.aima.service.AuthenticationService;
import com.aima.service.EmailService;
import com.aima.service.Impl.RegistrationServiceImpl;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Đăng ký 2 bước qua OTP với Redis THẬT (TTL, đếm sai, chờ gửi lại, dùng 1 lần là logic Redis nên
 * mock sẽ không kiểm được gì). Cần Redis ở {@code REGISTER_TEST_REDIS_PORT} (mặc định 56379 — container
 * {@code aima_redis_uitest}); không có Redis thì test tự bỏ qua. Repository/email/token là mock.
 */
class RegistrationOtpFlowTest {

    private static final String EMAIL = "reg.otp.test@example.com";

    private LettuceConnectionFactory factory;
    private StringRedisTemplate redis;
    private UserRepository userRepository;
    private EmailService emailService;
    private RegistrationServiceImpl service;
    private final HttpServletResponse response = mock(HttpServletResponse.class);

    @BeforeEach
    void setUp() {
        int port = Integer.parseInt(System.getenv().getOrDefault("REGISTER_TEST_REDIS_PORT", "56379"));
        factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration("localhost", port));
        factory.afterPropertiesSet();
        factory.start();
        boolean up;
        try {
            factory.getConnection().ping();
            up = true;
        } catch (Exception e) {
            up = false;
        }
        assumeTrue(up, "Redis test không chạy trên cổng " + port);

        redis = new StringRedisTemplate(factory);
        clearKeys();

        userRepository = mock(UserRepository.class);
        RoleRepository roleRepository = mock(RoleRepository.class);
        when(roleRepository.findByRoleName("USER")).thenReturn(Optional.of(Role.builder().roleName("USER").build()));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        emailService = mock(EmailService.class);
        AuthenticationService authenticationService = mock(AuthenticationService.class);
        when(authenticationService.generateTokenForOAuth2User(any()))
                .thenReturn(AuthenticationResponse.builder().token("access").refreshToken("refresh").build());

        service = new RegistrationServiceImpl(redis, new BCryptPasswordEncoder(4), userRepository, roleRepository,
                new UserMapperImpl(), emailService, authenticationService, mock(CookieUtils.class),
                mock(ActivityLogService.class));
        ReflectionTestUtils.setField(service, "otpTtlSeconds", 300L);
        ReflectionTestUtils.setField(service, "maxAttempts", 5L);
        ReflectionTestUtils.setField(service, "resendCooldownSeconds", 60L);
        ReflectionTestUtils.setField(service, "pendingTtlSeconds", 1800L);
    }

    @AfterEach
    void tearDown() {
        if (redis != null) clearKeys();
        if (factory != null) factory.destroy();
    }

    private void clearKeys() {
        for (String p : new String[]{"reg_pending:", "reg_otp:", "reg_otp_attempt:", "reg_otp_cooldown:"}) {
            redis.delete(p + EMAIL);
        }
    }

    private UserRegisterRequest request(String email) {
        return UserRegisterRequest.builder().fullName("Test User").email(email).password("Passw0rd!").build();
    }

    /** Mã OTP vừa gửi (bắt từ mock email — Redis chỉ giữ bản hash). */
    private String lastOtp() {
        ArgumentCaptor<String> otp = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).sendRegisterOtpEmail(eq(EMAIL), otp.capture(), any(), anyLong());
        return otp.getValue();
    }

    private ErrorCode errorOf(Runnable r) {
        AppException e = assertThrows(AppException.class, r::run);
        return e.getErrorCode();
    }

    @Test
    void existingEmail_rejectedWithoutSendingOtp_caseInsensitive() {
        when(userRepository.existsByEmailIgnoreCase(EMAIL)).thenReturn(true);

        assertEquals(ErrorCode.EMAIL_EXISTED, errorOf(() -> service.startRegistration(request("  Reg.OTP.Test@Example.com "))));
        verifyNoInteractions(emailService);
        assertFalse(Boolean.TRUE.equals(redis.hasKey("reg_pending:" + EMAIL)));
    }

    @Test
    void startRegistration_doesNotCreateUser_andStoresHashedData() {
        var res = service.startRegistration(request("Reg.OTP.Test@Example.com"));

        assertEquals(EMAIL, res.getResult().getEmail());
        verify(userRepository, never()).saveAndFlush(any());
        String otp = lastOtp();
        assertTrue(otp.matches("\\d{6}"));
        // OTP và mật khẩu chỉ nằm trong Redis ở dạng BCrypt.
        assertNotEquals(otp, redis.opsForValue().get("reg_otp:" + EMAIL));
        assertNotEquals("Passw0rd!", redis.opsForHash().get("reg_pending:" + EMAIL, "password"));
        long ttl = redis.getExpire("reg_otp:" + EMAIL);
        assertTrue(ttl > 290 && ttl <= 300, "TTL OTP = " + ttl);
    }

    @Test
    void correctOtp_createsAccountOnce_andCodeIsSingleUse() {
        service.startRegistration(request(EMAIL));
        String otp = lastOtp();

        var res = service.verifyRegistration(new RegisterVerifyRequest(EMAIL, otp), response);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals(EMAIL, saved.getValue().getEmail());
        assertEquals(EMAIL, saved.getValue().getUsername());
        assertNull(saved.getValue().getProvider());
        assertTrue(new BCryptPasswordEncoder().matches("Passw0rd!", saved.getValue().getPassword()));
        assertEquals(EMAIL, res.getResult().getEmail());

        // Dùng lại đúng mã đó → phiên đăng ký đã bị xoá.
        assertEquals(ErrorCode.REGISTRATION_SESSION_EXPIRED,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, otp), response)));
        verify(userRepository, times(1)).saveAndFlush(any());
    }

    @Test
    void fiveWrongAttempts_burnTheCode_thenResendWorksAfterCooldown() {
        service.startRegistration(request(EMAIL));
        String otp = lastOtp();
        String wrong = otp.equals("000000") ? "111111" : "000000";

        for (int i = 1; i <= 4; i++) {
            assertEquals(ErrorCode.REGISTER_OTP_INCORRECT,
                    errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, wrong), response)));
        }
        assertEquals(ErrorCode.OTP_ATTEMPTS_EXCEEDED,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, wrong), response)));
        // Mã đúng cũng hết dùng được.
        assertEquals(ErrorCode.OTP_NOT_FOUND,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, otp), response)));

        // Gửi lại ngay → bị chặn 60s; hết chờ → mã mới dùng được.
        assertEquals(ErrorCode.OTP_RESEND_TOO_SOON,
                errorOf(() -> service.resendOtp(new RegisterResendOtpRequest(EMAIL))));
        redis.delete("reg_otp_cooldown:" + EMAIL);
        service.resendOtp(new RegisterResendOtpRequest(EMAIL));
        String fresh = lastOtp();

        service.verifyRegistration(new RegisterVerifyRequest(EMAIL, fresh), response);
        verify(userRepository, times(1)).saveAndFlush(any());
    }

    @Test
    void resend_invalidatesPreviousCode() {
        service.startRegistration(request(EMAIL));
        String first = lastOtp();
        redis.delete("reg_otp_cooldown:" + EMAIL);
        service.resendOtp(new RegisterResendOtpRequest(EMAIL));
        String second = lastOtp();
        assumeTrue(!first.equals(second));

        assertEquals(ErrorCode.REGISTER_OTP_INCORRECT,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, first), response)));
    }

    @Test
    void registerTwiceWithinCooldown_rejected() {
        service.startRegistration(request(EMAIL));
        assertEquals(ErrorCode.OTP_RESEND_TOO_SOON, errorOf(() -> service.startRegistration(request(EMAIL))));
        verify(emailService, times(1)).sendRegisterOtpEmail(any(), any(), any(), anyLong());
    }

    @Test
    void expiredOtp_rejected() {
        service.startRegistration(request(EMAIL));
        redis.delete("reg_otp:" + EMAIL); // tương đương TTL hết hạn

        assertEquals(ErrorCode.OTP_NOT_FOUND,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, "123456"), response)));
    }

    @Test
    void emailTakenWhileWaitingForOtp_noDuplicateAccount() {
        service.startRegistration(request(EMAIL));
        String otp = lastOtp();
        when(userRepository.existsByEmailIgnoreCase(EMAIL)).thenReturn(true); // vd vừa đăng nhập Google

        assertEquals(ErrorCode.EMAIL_EXISTED,
                errorOf(() -> service.verifyRegistration(new RegisterVerifyRequest(EMAIL, otp), response)));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void emailSendFailure_releasesCooldown() {
        doThrow(new RuntimeException("brevo down")).when(emailService)
                .sendRegisterOtpEmail(any(), any(), any(), anyLong());

        assertThrows(RuntimeException.class, () -> service.startRegistration(request(EMAIL)));
        assertFalse(Boolean.TRUE.equals(redis.hasKey("reg_otp_cooldown:" + EMAIL)));
        assertFalse(Boolean.TRUE.equals(redis.hasKey("reg_otp:" + EMAIL)));
    }
}
