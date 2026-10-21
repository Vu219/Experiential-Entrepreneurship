package com.aima.service;

import com.aima.dto.event.SubscriptionPlanChangedEvent;

import java.util.UUID;

/**
 * Đồng bộ lịch chưa đăng với quyền của GÓI hiện tại: nền tảng không còn thuộc gói → Tạm giữ PLAN_PLATFORM_EXCLUDED;
 * gói tắt lên lịch → PLAN_SCHEDULING_DISABLED; một thông báo SCHEDULE_HELD / (lý do, nền tảng). KHÔNG bao giờ tự gỡ lý
 * do — user tự tiếp tục từng lịch khi gói cho phép lại. Khoá nền tảng toàn hệ thống đi đường riêng
 * ({@code PlatformAvailabilityService}); dispatcher/worker là chốt chặn cuối.
 */
public interface EntitlementHoldService {

    /** Subscription đổi gói (thanh toán / hết hạn / admin) — chạy trong transaction đổi gói. */
    void onPlanChanged(SubscriptionPlanChangedEvent event);

    /** Admin sửa giới hạn của gói: đồng bộ mọi user đang ở gói đó. @return số lịch vừa chuyển Tạm giữ */
    int syncPlanSubscribers(UUID planId);
}
