package com.aima.payment;

import com.aima.enums.PaymentOrderType;
import com.aima.enums.PlanSource;
import com.aima.exception.ErrorCode;
import com.aima.util.CheckoutPricing;
import com.aima.util.CheckoutPricing.Current;
import com.aima.util.CheckoutPricing.Proration;
import com.aima.util.CheckoutPricing.Quote;
import com.aima.util.CheckoutPricing.Target;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Công thức khấu trừ khi nâng cấp + mọi nhánh chặn của {@link CheckoutPricing}. Đồng hồ cố định
 * để số ngày không phụ thuộc lúc chạy test.
 */
class CheckoutPricingTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 30, 10, 0);
    private static final long MIN = 2_000L;

    private static final Target PRO = new Target("PRO", 1_990_000L, 1);

    private static Current paidPlus(long listPrice, LocalDateTime expiresAt) {
        return new Current("PLUS", false, listPrice, 1, PlanSource.PAYMENT, expiresAt);
    }

    // ================================================================ công thức

    @Test
    void prorate_tenOfThirtyDays_deductsOneThirdOfTheOldPrice() {
        // Hạn 10/10 → chu kỳ 10/9–10/10 = 30 ngày; còn đúng 10 ngày.
        Proration p = CheckoutPricing.prorate(500_000L, 300_000L, 1, NOW.plusDays(10), NOW);

        assertEquals(10, p.remainingDays());
        assertEquals(30, p.cycleDays());
        assertEquals(100_000L, p.credit());
        assertEquals(0L, p.rounding());
        assertEquals(400_000L, p.total());
    }

    @Test
    void prorate_roundsTotalDownToThousand_andReportsTheRoundingSeparately() {
        Proration p = CheckoutPricing.prorate(1_990_000L, 499_000L, 1, NOW.plusDays(10), NOW);

        assertEquals(166_333L, p.credit(), "499.000 × 10 / 30, làm tròn xuống tới đồng");
        assertEquals(667L, p.rounding());
        assertEquals(1_823_000L, p.total());
        assertEquals(1_990_000L - p.credit() - p.rounding(), p.total(),
                "các dòng trên trang tóm tắt phải cộng khớp tổng");
    }

    @Test
    void prorate_remainingDaysAreRoundedDown() {
        // Còn 10 ngày 23 giờ → tính 10 ngày (ngày đang dùng dở coi như đã dùng).
        LocalDateTime expires = NOW.plusDays(10).plusHours(23);

        assertEquals(10, CheckoutPricing.prorate(500_000L, 300_000L, 1, expires, NOW).remainingDays());
    }

    @Test
    void prorate_cycleUsesRealCalendarMonth_notAFixedThirtyDays() {
        LocalDateTime now = LocalDateTime.of(2026, 2, 20, 9, 0);
        LocalDateTime expires = LocalDateTime.of(2026, 3, 10, 9, 0);

        Proration p = CheckoutPricing.prorate(500_000L, 280_000L, 1, expires, now);

        assertEquals(28, p.cycleDays(), "chu kỳ 10/2–10/3 năm 2026 có 28 ngày");
        assertEquals(18, p.remainingDays());
        assertEquals(180_000L, p.credit());
    }

    // ================================================================ nâng cấp hợp lệ

    @Test
    void upgrade_paidPlanStillValid_isProratedAndRestartsAFullCycleFromNow() {
        Quote q = CheckoutPricing.quote(PRO, paidPlus(499_000L, NOW.plusDays(10)), NOW, MIN);

        assertTrue(q.purchasable());
        assertEquals(PaymentOrderType.UPGRADE, q.orderType());
        assertEquals(1_990_000L, q.subtotal());
        assertEquals(499_000L, q.oldListPrice());
        assertEquals(1_823_000L, q.total());
        assertEquals(NOW.plusMonths(1), q.newExpiresAt(), "hạn mới tính lại từ đầu, không cộng dồn");
    }

    // ================================================================ lớp chặn 1 — giá

    @Test
    void differentPlan_samePrice_isBlocked() {
        Target samePrice = new Target("BIZ", 499_000L, 1);

        Quote q = CheckoutPricing.quote(samePrice, paidPlus(499_000L, NOW.plusDays(10)), NOW, MIN);

        assertFalse(q.purchasable());
        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, q.blockedBy());
    }

    @Test
    void differentPlan_cheaper_isBlockedEvenWithMoreTokens() {
        // Tiêu chí mới là GIÁ, không phải hạn mức token.
        Target cheaper = new Target("LITE", 199_000L, 1);

        Quote q = CheckoutPricing.quote(cheaper, paidPlus(499_000L, NOW.plusDays(10)), NOW, MIN);

        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, q.blockedBy());
    }

    @Test
    void priceComparison_usesTheListPriceAtPurchase_notTodaysPlanPrice() {
        // Mua Plus lúc giá 2.500.000 (admin đã hạ giá sau đó) → Pro 1.990.000 không còn là "lên gói".
        Quote q = CheckoutPricing.quote(PRO, paidPlus(2_500_000L, NOW.plusDays(10)), NOW, MIN);

        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, q.blockedBy());
    }

    // ================================================================ lớp chặn 2 — tổng tiền

    @Test
    void upgrade_creditGreaterThanNewPrice_isBlocked() {
        // Gia hạn chồng 2 chu kỳ Plus (còn ~60 ngày) rồi nâng lên gói chỉ đắt hơn chút.
        Target slightlyMore = new Target("PLUS_MAX", 550_000L, 1);

        Quote q = CheckoutPricing.quote(slightlyMore, paidPlus(499_000L, NOW.plusDays(60)), NOW, MIN);

        assertFalse(q.purchasable());
        assertEquals(ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE, q.blockedBy());
        assertTrue(q.total() <= 0);
    }

    @Test
    void upgrade_fromYearlyToMonthly_isBlocked() {
        // Gói năm thường đắt hơn gói tháng → chặn ngay ở lớp giá.
        Current yearly = new Current("PLUS_Y", false, 4_990_000L, 12, PlanSource.PAYMENT, NOW.plusDays(200));
        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, CheckoutPricing.quote(PRO, yearly, NOW, MIN).blockedBy());
    }

    @Test
    void upgrade_totalBelowGatewayMinimum_isBlocked() {
        // Hạn 30/10 → chu kỳ 30/9–30/10 = 30 ngày, còn đủ 30 → khấu trừ 300.000 → còn 1.000đ < 2.000đ.
        Target plus1k = new Target("PLUS_1K", 301_000L, 1);

        Quote q = CheckoutPricing.quote(plus1k, paidPlus(300_000L, NOW.plusMonths(1)), NOW, MIN);

        assertEquals(1_000L, q.total());
        assertEquals(ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE, q.blockedBy());
    }

    @Test
    void upgrade_totalRoundedToZero_isBlockedEvenWithoutAConfiguredMinimum() {
        Target plus500 = new Target("PLUS_500", 300_500L, 1);

        Quote q = CheckoutPricing.quote(plus500, paidPlus(300_000L, NOW.plusMonths(1)), NOW, 0L);

        assertEquals(0L, q.total(), "500đ làm tròn xuống thành 0");
        assertEquals(ErrorCode.UPGRADE_CREDIT_EXCEEDS_PRICE, q.blockedBy());
    }

    @Test
    void neverPurchasableBelowMinimum_acrossAGridOfPricesAndDays() {
        long[] prices = {1_000L, 2_000L, 99_000L, 299_500L, 499_000L, 500_000L, 1_990_000L, 4_990_000L};
        for (long oldPrice : prices) {
            for (long newPrice : prices) {
                for (int days = 0; days <= 400; days += 7) {
                    for (int months : new int[]{1, 3, 12}) {
                        Current cur = new Current("OLD", false, oldPrice, months, PlanSource.PAYMENT,
                                NOW.plusDays(days).plusHours(1));
                        Quote q = CheckoutPricing.quote(new Target("NEW", newPrice, 1), cur, NOW, MIN);
                        if (q.purchasable()) {
                            assertTrue(q.total() >= MIN, "đơn mua được phải ≥ mức tối thiểu");
                            assertTrue(q.total() <= newPrice, "không bao giờ thu quá giá niêm yết");
                        }
                    }
                }
            }
        }
    }

    // ================================================================ không khấu trừ

    @Test
    void adminGrantedPlan_getsNoCredit_andIsANewPurchase() {
        Current admin = new Current("PLUS", false, 499_000L, 1, PlanSource.ADMIN, NOW.plusDays(20));

        Quote q = CheckoutPricing.quote(PRO, admin, NOW, MIN);

        assertTrue(q.purchasable());
        assertEquals(PaymentOrderType.NEW, q.orderType());
        assertNull(q.proration());
        assertEquals(1_990_000L, q.total());
        assertEquals(NOW.plusMonths(1), q.newExpiresAt());
    }

    @Test
    void adminGrantedPlan_stillCannotMoveToACheaperPlan() {
        Current admin = new Current("PRO", false, 1_990_000L, 1, PlanSource.ADMIN, NOW.plusDays(20));

        Quote q = CheckoutPricing.quote(new Target("PLUS", 499_000L, 1), admin, NOW, MIN);

        assertEquals(ErrorCode.PLAN_DOWNGRADE_NOT_ALLOWED, q.blockedBy());
    }

    @Test
    void freeOrExpiredPlan_isANewPurchaseAtListPrice() {
        Current free = new Current("FREE", true, 0L, 1, PlanSource.FREE, null);
        Current expired = paidPlus(1_990_000L, NOW.minusDays(1));
        Target plus = new Target("PLUS", 499_500L, 1);

        for (Current cur : new Current[]{null, free, expired}) {
            Quote q = CheckoutPricing.quote(plus, cur, NOW, MIN);
            assertTrue(q.purchasable());
            assertEquals(PaymentOrderType.NEW, q.orderType());
            assertEquals(499_500L, q.total(), "mua mới thu đúng giá niêm yết, không làm tròn");
        }
    }

    @Test
    void renewSamePlan_accumulatesOnTheOldExpiry_withoutCredit() {
        LocalDateTime expires = NOW.plusDays(10);

        Quote q = CheckoutPricing.quote(new Target("PLUS", 499_000L, 1), paidPlus(499_000L, expires), NOW, MIN);

        assertTrue(q.purchasable());
        assertEquals(PaymentOrderType.RENEW, q.orderType());
        assertNull(q.proration());
        assertEquals(499_000L, q.total());
        assertEquals(expires.plusMonths(1), q.newExpiresAt());
    }

    @Test
    void renewSamePlan_thatNeverExpires_isBlocked() {
        Current permanent = new Current("PRO", false, 1_990_000L, 1, PlanSource.ADMIN, null);

        Quote q = CheckoutPricing.quote(PRO, permanent, NOW, MIN);

        assertEquals(ErrorCode.PLAN_ALREADY_PERMANENT, q.blockedBy());
    }

    @Test
    void newPurchase_priceBelowGatewayMinimum_isBlocked() {
        Quote q = CheckoutPricing.quote(new Target("TINY", 1_000L, 1), null, NOW, MIN);

        assertEquals(ErrorCode.PAYMENT_AMOUNT_BELOW_MINIMUM, q.blockedBy());
    }
}
