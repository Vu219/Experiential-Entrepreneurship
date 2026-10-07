package com.aima.scheduler;

import com.aima.service.AnalyticsAccountSyncService;
import com.aima.service.AnalyticsSyncService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Job chỉ điều phối: chuẩn bị → đồng bộ cấp tài khoản (import bài ngoài AIMA + insights) → đồng bộ từng tài khoản
 * có bài đến hạn → dừng cả lượt khi bị rate limit.
 */
class AnalyticsCollectionJobTest {

    @Test
    void run_syncsEveryDueAccount() {
        AnalyticsSyncService service = mock(AnalyticsSyncService.class);
        AnalyticsAccountSyncService accountService = mock(AnalyticsAccountSyncService.class);
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        Map<UUID, List<UUID>> due = new LinkedHashMap<>();
        due.put(a, List.of(UUID.randomUUID()));
        due.put(b, List.of(UUID.randomUUID()));
        when(service.findDue(any(), anyInt())).thenReturn(due);
        when(service.syncAccount(any(), any())).thenReturn(true);
        when(accountService.findDue(any(), anyInt())).thenReturn(List.of(a));
        when(accountService.sync(a)).thenReturn(true);

        new AnalyticsCollectionJob(service, accountService).run();

        // Cấp tài khoản chạy TRƯỚC để bài vừa import được đồng bộ số liệu ngay trong lượt.
        InOrder order = inOrder(service, accountService);
        order.verify(service).prepare(AnalyticsCollectionJob.PREPARE_BATCH);
        order.verify(accountService).sync(a);
        order.verify(service).syncAccount(eq(a), any());
        verify(service).syncAccount(eq(b), any());
    }

    @Test
    void run_rateLimited_stopsBeforeNextAccount() {
        AnalyticsSyncService service = mock(AnalyticsSyncService.class);
        AnalyticsAccountSyncService accountService = mock(AnalyticsAccountSyncService.class);
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        Map<UUID, List<UUID>> due = new LinkedHashMap<>();
        due.put(a, List.of(UUID.randomUUID()));
        due.put(b, List.of(UUID.randomUUID()));
        when(service.findDue(any(), anyInt())).thenReturn(due);
        when(service.syncAccount(eq(a), any())).thenReturn(false);
        when(accountService.findDue(any(), anyInt())).thenReturn(List.of());

        new AnalyticsCollectionJob(service, accountService).run();

        verify(service, never()).syncAccount(eq(b), any());
    }

    @Test
    void run_accountLevelRateLimited_skipsPostSync() {
        AnalyticsSyncService service = mock(AnalyticsSyncService.class);
        AnalyticsAccountSyncService accountService = mock(AnalyticsAccountSyncService.class);
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        when(accountService.findDue(any(), anyInt())).thenReturn(List.of(a, b));
        when(accountService.sync(a)).thenReturn(false);

        new AnalyticsCollectionJob(service, accountService).run();

        verify(accountService, never()).sync(b);
        verify(service, never()).findDue(any(), anyInt());
    }
}
