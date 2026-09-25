package com.aima.enums;

import java.time.LocalDateTime;

/**
 * Đơn vị thời hạn admin nhập khi gia hạn / đổi gói cho một user, kèm trần cho phép của từng
 * đơn vị (user chốt 25/9: 1–365 ngày, 1–52 tuần, 1–24 tháng).
 *
 * <p>Tháng cộng theo lịch ({@code plusMonths}) — 31/1 + 1 tháng = 28/29/2, cùng quy tắc với
 * luồng thanh toán ({@code activatePaidPlan}) để hai đường cho cùng một mốc hết hạn.</p>
 */
public enum DurationUnit {
    DAY(365),
    WEEK(52),
    MONTH(24);

    private final int max;

    DurationUnit(int max) {
        this.max = max;
    }

    public boolean allows(Integer amount) {
        return amount != null && amount >= 1 && amount <= max;
    }

    public LocalDateTime addTo(LocalDateTime base, int amount) {
        return switch (this) {
            case DAY -> base.plusDays(amount);
            case WEEK -> base.plusWeeks(amount);
            case MONTH -> base.plusMonths(amount);
        };
    }
}
