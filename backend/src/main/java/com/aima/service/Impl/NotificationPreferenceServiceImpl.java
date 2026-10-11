package com.aima.service.Impl;

import com.aima.dto.request.NotificationPreferenceRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.dto.response.UnsubscribeResponse;
import com.aima.entity.User;
import com.aima.entity.UserNotificationPreference;
import com.aima.enums.EmailPromptStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.NotificationPreferenceMapper;
import com.aima.repository.UserNotificationPreferenceRepository;
import com.aima.repository.UserRepository;
import com.aima.service.NotificationPreferenceService;
import com.aima.util.UnsubscribeTokenCodec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Email lỗi đăng bài là OPT-IN: mặc định không nhận, người dùng bật ở banner trang Bài lỗi hoặc Cài đặt → Thông báo.
 * Khoá ký link huỷ nhận: {@code aima.notifications.unsubscribe-secret}; để trống → suy ra từ {@code jwt.signerKey}
 * (SHA-256 có tiền tố riêng — đổi signer key thì link cũ hết hiệu lực, chấp nhận được với link huỷ nhận).
 */
@Service
@Slf4j
public class NotificationPreferenceServiceImpl implements NotificationPreferenceService {

    private final UserRepository userRepository;
    private final UserNotificationPreferenceRepository preferenceRepository;
    private final NotificationPreferenceMapper mapper;
    private final UnsubscribeTokenCodec codec;
    private final boolean emailEnabled;

    public NotificationPreferenceServiceImpl(
            UserRepository userRepository,
            UserNotificationPreferenceRepository preferenceRepository,
            NotificationPreferenceMapper mapper,
            @Value("${aima.notifications.unsubscribe-secret:}") String secret,
            @Value("${jwt.signerKey:}") String jwtSignerKey,
            @Value("${aima.notifications.unsubscribe-ttl-days:60}") long ttlDays,
            @Value("${aima.notifications.publish-email-enabled:false}") boolean emailEnabled) {
        this.userRepository = userRepository;
        this.preferenceRepository = preferenceRepository;
        this.mapper = mapper;
        this.emailEnabled = emailEnabled;
        this.codec = new UnsubscribeTokenCodec(signingKey(secret, jwtSignerKey), Duration.ofDays(ttlDays),
                Clock.systemUTC());
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<NotificationPreferenceResponse> get(String email) {
        User user = currentUser(email);
        return ApiResponse.success("Lấy cài đặt thông báo thành công",
                mapper.toResponse(preferenceOf(user.getId()), emailEnabled));
    }

    @Override
    @Transactional
    public ApiResponse<NotificationPreferenceResponse> update(String email, NotificationPreferenceRequest request) {
        User user = currentUser(email);
        UserNotificationPreference preference = preferenceOf(user.getId());
        boolean enable = Boolean.TRUE.equals(request.getEmailPublishErrors());
        preference.setEmailPublishErrors(enable);
        preference.setEmailPromptStatus(enable ? EmailPromptStatus.ACCEPTED : EmailPromptStatus.DECLINED);
        preference.setConsentAt(enable ? Instant.now() : null);
        preference.setUpdatedAt(Instant.now());
        UserNotificationPreference saved = preferenceRepository.save(preference);
        log.info("[NotifyPref] User {} {} email lỗi đăng bài", user.getId(), enable ? "BẬT" : "tắt");
        return ApiResponse.success(enable ? "Đã bật email thông báo lỗi đăng bài" : "Đã tắt email thông báo lỗi đăng bài",
                mapper.toResponse(saved, emailEnabled));
    }

    @Override
    @Transactional
    public ApiResponse<UnsubscribeResponse> unsubscribe(String token) {
        UUID userId = codec.verify(token);
        // User đã xoá vẫn trả thành công (không tiết lộ tài khoản có tồn tại hay không).
        if (userRepository.existsById(userId)) {
            UserNotificationPreference preference = preferenceOf(userId);
            preference.setEmailPublishErrors(false);
            preference.setConsentAt(null);
            if (preference.getEmailPromptStatus() == EmailPromptStatus.NOT_ASKED) {
                preference.setEmailPromptStatus(EmailPromptStatus.DECLINED);
            }
            preference.setUpdatedAt(Instant.now());
            preferenceRepository.save(preference);
            log.info("[NotifyPref] User {} huỷ nhận email lỗi đăng bài qua link trong email", userId);
        }
        return ApiResponse.success("Đã huỷ nhận email thông báo lỗi đăng bài", mapper.toUnsubscribed());
    }

    @Override
    public UserNotificationPreference preferenceOf(UUID userId) {
        return preferenceRepository.findById(userId).orElseGet(() -> mapper.toDefault(userId));
    }

    @Override
    public String unsubscribeToken(UUID userId) {
        return codec.issue(userId);
    }

    private static byte[] signingKey(String secret, String jwtSignerKey) {
        if (secret != null && !secret.isBlank()) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }
        try {
            String base = jwtSignerKey == null || jwtSignerKey.isBlank() ? "aima-dev-only-unsubscribe" : jwtSignerKey;
            return MessageDigest.getInstance("SHA-256")
                    .digest(("aima-email-unsubscribe:" + base).getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
