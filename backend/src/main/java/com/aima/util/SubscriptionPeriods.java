package com.aima.util;

import java.time.LocalDateTime;

/**
 * Kỳ tính lượt theo CHU KỲ THANH TOÁN (V20): các kỳ dài một tháng, neo theo {@code period_anchor_at} (gói trả tiền =
 * lúc kích hoạt, Free = ngày tạo subscription). Hàm thuần — nguồn DUY NHẤT của quy tắc lăn kỳ.
 *
 * <p>Chuyển tiếp an toàn: kỳ mới bắt đầu = max(cuối kỳ cũ, mốc neo gần nhất ≤ now) nên không bao giờ chồng lên kỳ cũ —
 * lượt đã dùng không bị tính lại; kỳ chuyển tiếp có thể ngắn hơn một tháng (có lợi cho người dùng).</p>
 */
public final class SubscriptionPeriods {

    private SubscriptionPeriods() {
    }

    public record Period(LocalDateTime start, LocalDateTime end) {
    }

    /** Kỳ đầu tiên bắt đầu tại {@code anchor}. */
    public static Period firstPeriod(LocalDateTime anchor) {
        return new Period(anchor, anchor.plusMonths(1));
    }

    /**
     * Kỳ chứa {@code now} khi kỳ cũ (kết thúc {@code previousEnd}) đã hết. Mốc neo tính bằng {@code anchor.plusMonths(k)}
     * (không cộng dồn từng tháng) để ngày 31 không trôi dần về ngày 28.
     */
    public static Period periodContaining(LocalDateTime anchor, LocalDateTime previousEnd, LocalDateTime now) {
        if (anchor == null || anchor.isAfter(now)) {
            anchor = previousEnd != null && !previousEnd.isAfter(now) ? previousEnd : now;
        }
        long months = Math.max(0, java.time.temporal.ChronoUnit.MONTHS.between(anchor, now));
        LocalDateTime cycleStart = anchor.plusMonths(months);
        if (cycleStart.isAfter(now)) {
            cycleStart = anchor.plusMonths(--months);
        }
        LocalDateTime cycleEnd = anchor.plusMonths(months + 1);
        while (!cycleEnd.isAfter(now)) {
            months++;
            cycleStart = anchor.plusMonths(months);
            cycleEnd = anchor.plusMonths(months + 1);
        }
        LocalDateTime start = previousEnd != null && previousEnd.isAfter(cycleStart) ? previousEnd : cycleStart;
        return new Period(start, cycleEnd);
    }
}
