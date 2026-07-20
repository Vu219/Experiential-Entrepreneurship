package com.aima.enums;

import java.util.List;

/**
 * Trạng thái một lần thanh toán ({@code payments}).
 *
 * <p>{@code PENDING} có ý nghĩa THẬT, không phải giá trị trang trí: bản ghi được tạo ngay khi
 * hệ thống sinh link thanh toán và người dùng chưa trả tiền trên cổng. Cổng (payOS) sẽ chuyển
 * bản ghi sang {@link #PAID} hoặc {@link #FAILED} qua webhook; đơn quá hạn không trả cũng về
 * {@link #FAILED} kèm {@code failed_reason}.
 *
 * <p>Doanh thu CHỈ tính {@link #PAID}/{@link #REFUNDED}/{@link #PARTIALLY_REFUNDED} (những đơn
 * đã thực sự thu được tiền) — xem công thức ở {@code RevenueServiceImpl}. PENDING/FAILED vẫn
 * hiện trong bảng giao dịch để admin theo dõi sức khoẻ cổng thanh toán.
 */
public enum PaymentStatus {

    /** Đã tạo đơn/link, ĐANG CHỜ người dùng thanh toán trên cổng. Chưa thu được tiền. */
    PENDING,

    /** Đã thu tiền thành công ({@code paid_at} bắt buộc có giá trị). */
    PAID,

    /** Thất bại/huỷ/hết hạn — lý do lưu ở {@code failed_reason}. */
    FAILED,

    /** Đã hoàn TOÀN BỘ ({@code refunded_amount} = {@code amount}). */
    REFUNDED,

    /** Đã hoàn MỘT PHẦN ({@code 0 < refunded_amount < amount}). */
    PARTIALLY_REFUNDED;

    /**
     * Các trạng thái đã THỰC SỰ thu được tiền — MỘT nguồn duy nhất cho mọi query doanh thu
     * (bind vào {@code status in (:paidStatuses)}, không rải literal SQL nhiều nơi, rule #23).
     * Đơn đã hoàn tiền vẫn nằm đây: nó có thu tiền ở kỳ trả, phần hoàn bị trừ riêng ở kỳ hoàn.
     */
    public static List<String> revenueRecognizedNames() {
        return List.of(PAID.name(), REFUNDED.name(), PARTIALLY_REFUNDED.name());
    }
}
