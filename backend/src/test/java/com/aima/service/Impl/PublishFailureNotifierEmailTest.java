package com.aima.service.Impl;

import com.aima.dto.publish.PublishFailureNotice;
import com.aima.entity.User;
import com.aima.entity.UserNotificationPreference;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.repository.UserRepository;
import com.aima.service.EmailService;
import com.aima.service.NotificationPreferenceService;
import com.aima.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Quyết định gửi email lỗi đăng bài nằm ở MỘT chỗ trong notifier: thông báo trong app luôn có; email chỉ khi máy chủ
 * bật VÀ người dùng đồng ý; email kèm token huỷ nhận; email cho lỗi của riêng bài tối đa một lần/ngày.
 */
class PublishFailureNotifierEmailTest {

    final UserRepository userRepository = mock(UserRepository.class);
    final NotificationService notificationService = mock(NotificationService.class);
    final EmailService emailService = mock(EmailService.class);
    final NotificationPreferenceService preferenceService = mock(NotificationPreferenceService.class);
    final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    final ValueOperations<String, String> ops = mock(ValueOperations.class);

    final User user = User.builder().email("owner@aima.vn").fullName("Owner").build();
    PublishFailureNotifierImpl notifier;

    @BeforeEach
    void setUp() {
        user.setId(UUID.randomUUID());
        notifier = new PublishFailureNotifierImpl(userRepository, notificationService, emailService, preferenceService, redis);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(notificationService.send(any(), any())).thenReturn(true);
        when(preferenceService.unsubscribeToken(user.getId())).thenReturn("signed-token");
        when(redis.opsForValue()).thenReturn(ops);
    }

    private void serverEnabled(boolean on) {
        ReflectionTestUtils.setField(notifier, "emailEnabled", on);
    }

    private void consent(boolean on) {
        UserNotificationPreference p = new UserNotificationPreference();
        p.setUserId(user.getId());
        p.setEmailPublishErrors(on);
        when(preferenceService.preferenceOf(user.getId())).thenReturn(p);
    }

    private PublishFailureNotice notice(PublishErrorCode code) {
        return new PublishFailureNotice(user.getId(), UUID.randomUUID(), "Trang AIMA", Platform.FACEBOOK,
                UUID.randomUUID(), UUID.randomUUID(), code);
    }

    @Test
    void serverOnAndConsented_accountLevelError_emailWithUnsubscribeToken() {
        serverEnabled(true);
        consent(true);
        notifier.notifyFailure(notice(PublishErrorCode.AUTH_TOKEN_EXPIRED), 0);

        verify(notificationService).send(eq(user), argThat(d -> d.type() == NotificationType.RECONNECT_NEEDED
                && d.dedupeKey() != null && "PUBLISH_ERROR".equals(d.params().get("variant"))));
        verify(emailService).sendPublishActionRequiredEmail(eq("owner@aima.vn"), eq("Owner"), anyString(), anyString(),
                anyString(), eq(PublishFailureNotifierImpl.RECONNECT_PATH), eq("signed-token"));
    }

    @Test
    void notConsented_inAppOnly_noEmail() {
        serverEnabled(true);
        consent(false);
        notifier.notifyFailure(notice(PublishErrorCode.AUTH_TOKEN_EXPIRED), 0);

        verify(notificationService).send(any(), any());
        verifyNoInteractions(emailService);
    }

    @Test
    void serverOff_consentedUser_stillNoEmail() {
        serverEnabled(false);
        consent(true);
        notifier.notifyFailure(notice(PublishErrorCode.AUTH_TOKEN_EXPIRED), 0);
        notifier.notifyFailure(notice(PublishErrorCode.CONTENT_DUPLICATE), 0);
        verifyNoInteractions(emailService);
    }

    @Test
    void postLevelErrors_atMostOneEmailPerDay() {
        serverEnabled(true);
        consent(true);
        when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true, false);

        notifier.notifyFailure(notice(PublishErrorCode.CONTENT_DUPLICATE), 0);
        notifier.notifyFailure(notice(PublishErrorCode.POLICY_VIOLATION), 0);

        verify(notificationService, times(2)).send(any(), argThat(d -> d.type() == NotificationType.POST_FAILED
                && d.params().get("code") != null && d.params().get("reference") != null));
        verify(emailService, times(1)).sendPublishActionRequiredEmail(anyString(), anyString(), anyString(), anyString(),
                anyString(), eq(PublishFailureNotifierImpl.FAILED_POSTS_PATH), eq("signed-token"));
    }

    @Test
    void emailFailure_doesNotBreakInAppNotification() {
        serverEnabled(true);
        consent(true);
        doThrow(new RuntimeException("Brevo down")).when(emailService).sendPublishActionRequiredEmail(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        notifier.notifyFailure(notice(PublishErrorCode.AUTH_TOKEN_EXPIRED), 0);
        verify(notificationService).send(any(), any());
    }
}
