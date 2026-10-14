package com.aima.scheduler;

import com.aima.dto.notification.NotificationDraft;
import com.aima.entity.PostSchedule;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import com.aima.repository.PostScheduleRepository;
import com.aima.service.NotificationService;
import com.aima.util.NotificationParams;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Nhắc bài sắp đăng trong {@value #LEAD_MINUTES} phút (nhóm REMINDERS — MẶC ĐỊNH TẮT, D7). Quét mỗi 5 phút; user chưa
 * bật nhắc thì {@code NotificationService.send} bỏ qua trước khi ghi DB. Dedupe theo lịch + giờ đăng: dời giờ thì
 * được nhắc lại cho giờ mới.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleUpcomingReminderJob {

    static final int LEAD_MINUTES = 30;

    PostScheduleRepository scheduleRepository;
    NotificationService notificationService;

    @Scheduled(fixedDelay = 300_000)
    @SchedulerLock(name = "schedule-upcoming-reminder", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    public void run() {
        Instant now = Instant.now();
        for (PostSchedule schedule : scheduleRepository.findUpcoming(now, now.plus(Duration.ofMinutes(LEAD_MINUTES)))) {
            try {
                var account = schedule.getPlatformAccount();
                notificationService.send(account.getUser(), NotificationDraft.builder()
                        .type(NotificationType.SCHEDULE_UPCOMING)
                        .title("Bài sắp được đăng")
                        .message("Một bài sẽ được đăng lên " + account.getPlatformName() + " (" + account.getAccountName()
                                + ") trong vòng " + LEAD_MINUTES + " phút tới.")
                        .refType(NotificationRefType.SCHEDULE).refId(schedule.getId())
                        .params(NotificationParams.of("platform", account.getPlatformName(),
                                "accountName", account.getAccountName(), "scheduledTime", schedule.getScheduledTime()))
                        .dedupeKey("schedule-upcoming:" + schedule.getId() + ":" + schedule.getScheduledTime().toEpochMilli())
                        .build());
            } catch (Exception e) {
                log.warn("[ScheduleUpcoming] Bỏ qua lịch {}: {}", schedule.getId(), e.getMessage());
            }
        }
    }
}
