package com.aima.dto.event;

import java.util.UUID;

/**
 * Gói hiện hành của một subscription vừa đổi (thanh toán, hết hạn, admin đổi/thu hồi, đồng bộ nhãn). Phát trong
 * transaction đổi gói; {@code EntitlementHoldService} nghe TRƯỚC commit để giữ lịch chưa đăng ngoài quyền gói mới.
 * Mang {@code planId} để listener không phải gọi lại {@code SubscriptionService.getOrCreate} (tránh tái nhập).
 */
public record SubscriptionPlanChangedEvent(UUID userId, UUID planId) {
}
