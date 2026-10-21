package com.aima.service;

import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;

/**
 * Thông báo {@code SCHEDULE_HELD} khi lịch chưa đăng bị giữ vì quyền dùng nền tảng / gói (PLATFORM_DISABLED,
 * PLAN_PLATFORM_EXCLUDED, PLAN_SCHEDULING_DISABLED). Gọi trong transaction đang mở — bản ghi INSERT cùng transaction,
 * SSE đẩy sau commit (NotificationService). Best-effort, có dedupe.
 */
public interface ScheduleHeldNotifier {

    /** Một thông báo gộp cho cả loạt lịch của user (admin khoá nền tảng, đổi/hết hạn gói). {@code count} ≤ 0 → bỏ qua. */
    void notifyBatch(User user, HoldReason reason, Platform platform, int count, String dedupeKey);

    /** Một lịch đến giờ đăng nhưng bị giữ (dispatcher / worker) — dedupe theo lịch + lý do. */
    void notifySchedule(PostSchedule schedule, HoldReason reason);
}
