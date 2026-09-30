package com.aima.repository.projection;

import com.aima.enums.ContentVersionStatus;
import com.aima.enums.ScheduleStatus;

/**
 * Đầu vào của ContentItemStatusResolver cho MỘT bản nền tảng còn hiệu lực: trạng thái sản xuất
 * + trạng thái lịch đăng (null = chưa có lịch còn hiệu lực).
 */
public record VersionPublishingState(ContentVersionStatus status, ScheduleStatus scheduleStatus) {
}
