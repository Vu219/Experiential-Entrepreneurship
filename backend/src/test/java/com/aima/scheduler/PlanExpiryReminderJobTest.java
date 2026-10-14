package com.aima.scheduler;

import com.aima.dto.notification.NotificationDraft;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.repository.SubscriptionRepository;
import com.aima.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Nhắc gói sắp hết hạn (D7): mốc 7 ngày cho còn 2–7 ngày, mốc 1 ngày cho ≤ 1 ngày; dedupe theo mốc + ngày hết hạn. */
class PlanExpiryReminderJobTest {

    private final NotificationService notificationService = mock(NotificationService.class);
    private final PlanExpiryReminderJob job = new PlanExpiryReminderJob(mock(SubscriptionRepository.class), notificationService);

    private Subscription subscription(LocalDate expiresOn) {
        Plan plan = new Plan();
        plan.setCode("PRO");
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setUser(new User());
        subscription.setPlan(plan);
        subscription.setPlanExpiresAt(expiresOn.atTime(10, 0));
        return subscription;
    }

    private NotificationDraft remind(int daysLeft) {
        LocalDate today = LocalDate.of(2026, 10, 14);
        reset(notificationService);
        job.remind(subscription(today.plusDays(daysLeft)), today);
        ArgumentCaptor<NotificationDraft> draft = ArgumentCaptor.forClass(NotificationDraft.class);
        verify(notificationService).send(any(), draft.capture());
        return draft.getValue();
    }

    @Test
    void milestones() {
        NotificationDraft seven = remind(7);
        assertEquals(NotificationType.PLAN_EXPIRING, seven.type());
        assertTrue(seven.dedupeKey().contains(":7:2026-10-21"), seven.dedupeKey());
        assertEquals(7L, seven.params().get("daysLeft"));

        assertTrue(remind(3).dedupeKey().contains(":7:"), "lỡ lượt chạy đúng ngày 7 → vẫn mốc 7");
        assertTrue(remind(1).dedupeKey().contains(":1:"));
        assertTrue(remind(0).dedupeKey().contains(":1:"), "hết hạn trong hôm nay → mốc 1");
    }
}
