package com.aima.util;

import com.aima.enums.PaymentOrderType;
import com.aima.enums.PlanSource;
import com.aima.exception.ErrorCode;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Tính tiền một đơn mua gói — hàm THUẦN (không DB, không mạng, không đồng hồ) để test được mọi
 * nhánh chặn. Dùng chung cho {@code GET /payments/quote} (trang "Xem lại đơn hàng") và
 * {@code POST /payments/checkout}, nên con số user nhìn thấy và con số bị thu là MỘT công thức.
 *
 * <p><b>Hai lớp chặn, không bao giờ để phát sinh đơn cần hoàn tiền</b> (hệ thống chưa có hoàn
 * tiền — user chốt 26/9):</p>
 * <ol>
 *   <li>Đổi sang gói KHÁC khi gói hiện tại còn hạn: giá gói mới phải CAO HƠN hẳn giá gói hiện tại
 *       ({@link ErrorCode#PLAN_DOWNGRADE_NOT_ALLOWED}).</li>
 *   <li>Tổng tiền cuối phải ≥ mức tối thiểu của cổng (và luôn &gt; 0) — nâng cấp:
 *       {@link ErrorCode#UPGRADE_CREDIT_EXCEEDS_PRICE}, còn lại:
 *       {@link ErrorCode#PAYMENT_AMOUNT_BELOW_MINIMUM}.</li>
 * </ol>
 *
 * <p><b>Khấu trừ khi nâng cấp</b> (chỉ gói TRẢ TIỀN còn hạn, {@code planSource = PAYMENT}):</p>
 * <pre>
 * số ngày còn lại  = số ngày TRÒN từ bây giờ tới hạn cũ (làm tròn xuống)
 * số ngày chu kỳ   = số ngày thật của chu kỳ kết thúc ở hạn cũ (tháng lịch, cùng plusMonths
 *                    của activatePaidPlan — không cố định 30)
 * khấu trừ         = giá niêm yết gói cũ × còn lại / chu kỳ          (làm tròn xuống tới đồng)
 * tổng             = (giá gói mới − khấu trừ) làm tròn xuống tới hàng nghìn
 * làm tròn         = (giá gói mới − khấu trừ) − tổng                  (dòng riêng trên trang)
 * </pre>
 * Mua mới / gia hạn thu đúng giá niêm yết, không làm tròn.
 */
public final class CheckoutPricing {

    static final long ROUNDING_UNIT = 1_000L;

    private CheckoutPricing() {
    }

    /** Gói muốn mua. */
    public record Target(String code, long price, int cycleMonths) {
    }

    /**
     * Gói đang dùng.
     *
     * @param listPrice giá niêm yết lúc mua (snapshot {@code payments.list_price}); gói admin cấp
     *                  thì là giá hiện tại của gói — chỉ dùng cho lớp chặn 1, không khấu trừ
     * @param expiresAt null = không hết hạn
     */
    public record Current(String code, boolean free, long listPrice, int cycleMonths,
                          PlanSource source, LocalDateTime expiresAt) {
    }

    /** Kết quả khấu trừ — mọi số đều hiển thị nguyên văn trên trang "Tóm tắt đơn hàng". */
    public record Proration(int remainingDays, int cycleDays, long credit, long rounding, long total) {
    }

    /**
     * Báo giá.
     *
     * @param proration null khi đơn không khấu trừ (mua mới / gia hạn)
     * @param blockedBy null = mua được
     */
    public record Quote(PaymentOrderType orderType, long subtotal, Long oldListPrice,
                        Proration proration, long total, LocalDateTime newExpiresAt,
                        ErrorCode blockedBy) {

        public boolean purchasable() {
            return blockedBy == null;
        }
    }

    public static Quote quote(Target target, Current current, LocalDateTime now, long minAmount) {
        long floor = Math.max(1L, minAmount);
        LocalDateTime freshExpiry = now.plusMonths(target.cycleMonths());

        boolean active = current != null && !current.free()
                && (current.expiresAt() == null || current.expiresAt().isAfter(now));
        if (!active) {
            return flat(PaymentOrderType.NEW, target, freshExpiry, floor, null);
        }

        if (current.code().equals(target.code())) {
            if (current.expiresAt() == null) {
                // Gói không hết hạn: "gia hạn" sẽ biến nó thành gói có hạn — chặn.
                return flat(PaymentOrderType.RENEW, target, null, floor, ErrorCode.PLAN_ALREADY_PERMANENT);
            }
            return flat(PaymentOrderType.RENEW, target,
                    current.expiresAt().plusMonths(target.cycleMonths()), floor, null);
        }

        // Lớp chặn 1: đổi gói khi còn hạn chỉ được lên gói ĐẮT HƠN.
        if (target.price() <= current.listPrice()) {
            return flat(PaymentOrderType.UPGRADE, target, freshExpiry, floor,
                    ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED);
        }

        // Gói admin cấp (khách không trả tiền) hoặc không có hạn: không khấu trừ, coi như mua mới.
        if (current.source() != PlanSource.PAYMENT || current.expiresAt() == null) {
            return flat(PaymentOrderType.NEW, target, freshExpiry, floor, null);
        }

        Proration p = prorate(target.price(), current.listPrice(), current.cycleMonths(),
                current.expiresAt(), now);
        // Lớp chặn 2: không bao giờ tạo đơn ≤ 0 hoặc dưới mức tối thiểu của cổng.
        ErrorCode blocked = p.total() < floor ? ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE : null;
        return new Quote(PaymentOrderType.UPGRADE, target.price(), current.listPrice(), p,
                p.total(), freshExpiry, blocked);
    }

    /** Công thức khấu trừ — xem javadoc lớp. */
    public static Proration prorate(long newPrice, long oldListPrice, int oldCycleMonths,
                                    LocalDateTime oldExpiresAt, LocalDateTime now) {
        int remainingDays = (int) Math.max(0, ChronoUnit.DAYS.between(now, oldExpiresAt));
        int cycleDays = (int) ChronoUnit.DAYS.between(oldExpiresAt.minusMonths(oldCycleMonths), oldExpiresAt);
        long credit = Math.multiplyExact(oldListPrice, remainingDays) / cycleDays;
        long raw = newPrice - credit;
        long rounding = raw > 0 ? raw % ROUNDING_UNIT : 0;
        return new Proration(remainingDays, cycleDays, credit, rounding, raw - rounding);
    }

    private static Quote flat(PaymentOrderType type, Target target, LocalDateTime newExpiresAt,
                              long floor, ErrorCode blocked) {
        ErrorCode reason = blocked != null ? blocked
                : target.price() < floor ? ErrorCode.PAYMENT_AMOUNT_BELOW_MINIMUM : null;
        return new Quote(type, target.price(), null, null, target.price(), newExpiresAt, reason);
    }
}
