package com.aima.service.Impl;

import com.aima.dto.notification.NotificationDraft;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.HoldReason;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import com.aima.enums.Platform;
import com.aima.service.NotificationService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.util.NotificationParams;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleHeldNotifierImpl implements ScheduleHeldNotifier {

    NotificationService notificationService;

    @Override
    public void notifyBatch(User user, HoldReason reason, Platform platform, int count, String dedupeKey) {
        if (count <= 0) {
            return;
        }
        notificationService.send(user, NotificationDraft.builder()
                .type(NotificationType.SCHEDULE_HELD)
                .title("Lịch đăng được tạm giữ")
                .message(count + " lịch chưa đăng" + platformText(platform) + " được chuyển sang Tạm giữ: " + reasonText(reason)
                        + " Khi được phép trở lại, hãy mở Lịch đăng và tiếp tục từng lịch (lịch đã quá giờ cần chọn giờ mới).")
                .refType(NotificationRefType.PLATFORM)
                .params(NotificationParams.of(NotificationParams.VARIANT, reason.name(),
                        "platform", platform, "count", count))
                .dedupeKey(dedupeKey)
                .build());
    }

    @Override
    public void notifySchedule(PostSchedule schedule, HoldReason reason) {
        Platform platform = schedule.getPlatformAccount().getPlatformName();
        notificationService.send(schedule.getPlatformAccount().getUser(), NotificationDraft.builder()
                .type(NotificationType.SCHEDULE_HELD)
                .title("Bài đến giờ đăng được tạm giữ")
                .message("Một lịch" + platformText(platform) + " không được đăng: " + reasonText(reason)
                        + " Mở Lịch đăng để tiếp tục khi được phép trở lại.")
                .refType(NotificationRefType.SCHEDULE).refId(schedule.getId())
                .params(NotificationParams.of(NotificationParams.VARIANT, reason.name(),
                        "platform", platform, "count", 1, "scheduleId", schedule.getId()))
                .dedupeKey("schedule-held:" + schedule.getId() + ":" + reason.name() + ":" + schedule.getScheduledTime())
                .build());
    }

    private static String platformText(Platform platform) {
        return platform == null ? "" : " trên " + platform.name();
    }

    private static String reasonText(HoldReason reason) {
        return switch (reason) {
            case PLATFORM_DISABLED -> "nền tảng đang tạm khoá trên toàn hệ thống.";
            case PLAN_PLATFORM_EXCLUDED -> "gói hiện tại không gồm nền tảng này.";
            case PLAN_SCHEDULING_DISABLED -> "gói hiện tại không gồm tính năng lên lịch.";
            default -> "lịch cần được kiểm tra lại.";
        };
    }
}
