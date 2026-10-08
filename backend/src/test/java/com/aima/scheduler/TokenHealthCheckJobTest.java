package com.aima.scheduler;

import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.NotificationType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlatformAccountRepository;
import com.aima.service.MetaOAuthService;
import com.aima.service.NotificationService;
import com.aima.service.ScheduleHoldService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** FR-18a: chỉ đánh dấu EXPIRED khi token thật sự chết (190) hoặc đã quá hạn; lỗi tạm thời → thử lại lượt sau. */
class TokenHealthCheckJobTest {

    private PlatformAccountRepository accountRepository;
    private ScheduleHoldService holdService;
    private MetaOAuthService metaOAuthService;
    private NotificationService notificationService;
    private TokenHealthCheckJob job;

    @BeforeEach
    void setUp() {
        accountRepository = mock(PlatformAccountRepository.class);
        holdService = mock(ScheduleHoldService.class);
        metaOAuthService = mock(MetaOAuthService.class);
        notificationService = mock(NotificationService.class);
        job = new TokenHealthCheckJob(accountRepository, holdService, metaOAuthService, notificationService);
    }

    private PlatformAccount account(LocalDateTime expiresAt) {
        PlatformAccount a = new PlatformAccount();
        a.setId(UUID.randomUUID());
        a.setUser(User.builder().email("u@gmail.com").build());
        a.setAccountName("acc");
        a.setConnectionStatus(ConnectionStatus.ACTIVE);
        a.setTokenExpiredAt(expiresAt);
        when(accountRepository.findByConnectionStatusAndTokenExpiredAtLessThanEqualAndDeletedAtIsNull(eq(ConnectionStatus.ACTIVE), any()))
                .thenReturn(List.of(a));
        return a;
    }

    @Test
    void transientFailure_tokenStillValid_keepsActiveAndRetriesNextRun() {
        PlatformAccount a = account(LocalDateTime.now().plusDays(3));
        when(metaOAuthService.refresh(a.getId())).thenThrow(new AppException(ErrorCode.TOKEN_REFRESH_FAILED));

        job.run();

        assertEquals(ConnectionStatus.ACTIVE, a.getConnectionStatus());
        verify(accountRepository, never()).save(any());
        verifyNoInteractions(holdService, notificationService);
    }

    @Test
    void failure_tokenAlreadyExpired_marksExpiredHoldsAndNotifies() {
        PlatformAccount a = account(LocalDateTime.now().minusHours(1));
        when(metaOAuthService.refresh(a.getId())).thenThrow(new AppException(ErrorCode.TOKEN_REFRESH_FAILED));

        job.run();

        assertEquals(ConnectionStatus.EXPIRED, a.getConnectionStatus());
        verify(holdService).holdForAccounts(List.of(a.getId()), HoldReason.ACCOUNT_ISSUE);
        verify(notificationService).notify(eq(a.getUser()), eq(NotificationType.RECONNECT_NEEDED), any(), any(), eq(a.getId()));
    }

    @Test
    void invalidToken_handledByRefresh_jobDoesNotMarkAgain() {
        PlatformAccount a = account(LocalDateTime.now().plusDays(3));
        PlatformAccount expired = new PlatformAccount();
        expired.setConnectionStatus(ConnectionStatus.EXPIRED);
        when(metaOAuthService.refresh(a.getId())).thenReturn(expired);

        job.run();

        verify(accountRepository, never()).save(any());
        verifyNoInteractions(holdService, notificationService);
    }
}
