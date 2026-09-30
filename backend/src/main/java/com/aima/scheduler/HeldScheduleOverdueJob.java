package com.aima.scheduler;

import com.aima.entity.PostSchedule;
import com.aima.enums.NotificationType;
import com.aima.repository.PostScheduleRepository;
import com.aima.service.NotificationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Lịch đang tạm giữ mà đã qua giờ đăng sẽ KHÔNG tự đăng khi hết lý do giữ (plan §2.2) — nhắc user chọn
 * giờ mới. Mỗi (lịch, giờ đăng) chỉ nhắc một lần nhờ {@code notifications.dedupe_key}; dời giờ rồi lại quá
 * giờ thì nhắc lại. Lỗi từng lịch chỉ log + bỏ qua.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class HeldScheduleOverdueJob {

    PostScheduleRepository scheduleRepository;
    NotificationService notificationService;

    @Scheduled(fixedDelay = 900_000)
    @SchedulerLock(name = "held-schedule-overdue", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void run() {
        for (PostSchedule schedule : scheduleRepository.findHeldOverdue(Instant.now())) {
            try {
                notificationService.notifyOnce(schedule.getPlatformAccount().getUser(), NotificationType.SCHEDULE_OVERDUE,
                        "Bài tạm giữ đã quá giờ đăng",
                        "Một bài lên lịch cho " + schedule.getPlatformAccount().getAccountName()
                                + " đang bị tạm giữ và đã qua giờ đăng — hệ thống sẽ không tự đăng. "
                                + "Hãy xử lý lý do tạm giữ rồi chọn giờ đăng mới trong Lịch đăng.",
                        schedule.getId(), dedupeKey(schedule));
            } catch (Exception e) {
                log.error("[HeldOverdue] Bỏ qua lịch {} do lỗi khi nhắc", schedule.getId(), e);
            }
        }
    }

    static String dedupeKey(PostSchedule schedule) {
        return "schedule-overdue:" + schedule.getId() + ":" + schedule.getScheduledTime().toEpochMilli();
    }
}
