package com.aima.scheduler;

import com.aima.dto.notification.NotificationDraft;
import com.aima.entity.Subscription;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import com.aima.repository.SubscriptionRepository;
import com.aima.service.NotificationService;
import com.aima.util.NotificationParams;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Nhắc gói trả tiền sắp hết hạn (D7: trước 7 ngày và 1 ngày) — 09:00 mỗi ngày. Hai "mốc" thay vì đúng ngày: còn 2–7
 * ngày → mốc 7, còn ≤ 1 ngày → mốc 1, mỗi mốc một lần (dedupe theo subscription + mốc + ngày hết hạn) — lỡ một lượt
 * chạy (deploy) vẫn nhắc ở lượt sau, gia hạn đổi ngày hết hạn thì mốc mới được nhắc lại. Email để sau (D8).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PlanExpiryReminderJob {

    static final int FIRST_REMINDER_DAYS = 7;
    static final int LAST_REMINDER_DAYS = 1;

    SubscriptionRepository subscriptionRepository;
    NotificationService notificationService;

    @Scheduled(cron = "${aima.notifications.plan-expiry-reminder-cron:0 0 9 * * *}")
    @SchedulerLock(name = "plan-expiry-reminder", lockAtMostFor = "PT15M", lockAtLeastFor = "PT1M")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        for (Subscription subscription : subscriptionRepository.findExpiringPlans(now, now.plusDays(FIRST_REMINDER_DAYS))) {
            try {
                remind(subscription, now.toLocalDate());
            } catch (Exception e) {
                log.warn("[PlanExpiryReminder] Bỏ qua subscription {}: {}", subscription.getId(), e.getMessage());
            }
        }
    }

    void remind(Subscription subscription, LocalDate today) {
        LocalDate expiresOn = subscription.getPlanExpiresAt().toLocalDate();
        long daysLeft = Math.max(0, ChronoUnit.DAYS.between(today, expiresOn));
        int milestone = daysLeft <= LAST_REMINDER_DAYS ? LAST_REMINDER_DAYS : FIRST_REMINDER_DAYS;
        String plan = subscription.getPlan().getCode();
        notificationService.send(subscription.getUser(), NotificationDraft.builder()
                .type(NotificationType.PLAN_EXPIRING)
                .title("Gói " + plan + " sắp hết hạn")
                .message("Gói " + plan + " của bạn sẽ hết hạn vào " + expiresOn + " (còn " + daysLeft
                        + " ngày). Gia hạn để không bị chuyển về gói Free.")
                .refType(NotificationRefType.SUBSCRIPTION).refId(subscription.getId())
                .params(NotificationParams.of("plan", plan, "daysLeft", daysLeft, "expiresAt", expiresOn))
                .dedupeKey("plan-expiring:" + subscription.getId() + ":" + milestone + ":" + expiresOn)
                .build());
    }
}
