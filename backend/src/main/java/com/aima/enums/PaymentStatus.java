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
 * đã thực sự thu được tiền) — xem công thức ở {@code RevenueServiceImpl}. Các trạng thái chưa
 * thu được tiền vẫn hiện trong bảng giao dịch để admin theo dõi sức khoẻ cổng thanh toán.
 *
 * <p><b>Tỉ lệ giao dịch thất bại</b> = {@code FAILED / (đã thu tiền + FAILED)}. {@link #EXPIRED}
 * và {@link #CANCELLED} KHÔNG nằm ở vế nào — khách bỏ giỏ hàng không phải cổng thanh toán hỏng.
 * Điều này đạt được tự nhiên vì {@code PaymentRepository.aggregateTotals} đếm đúng literal
 * {@code 'FAILED'}; đừng gộp ba trạng thái này lại.
 */
public enum PaymentStatus {

    /** Đã tạo đơn/link, ĐANG CHỜ người dùng thanh toán trên cổng. Chưa thu được tiền. */
    PENDING,

    /** Đã thu tiền thành công ({@code paid_at} bắt buộc có giá trị). */
    PAID,

    /**
     * Cổng thanh toán báo giao dịch HỎNG — lý do lưu ở {@code failed_reason}. CHỈ dùng cho
     * lỗi thật sự của giao dịch, KHÔNG dùng cho đơn hết giờ hay đơn bị huỷ (xem
     * {@link #EXPIRED} / {@link #CANCELLED}) — đây là vế duy nhất vào "tỉ lệ giao dịch
     * thất bại", nhét nhầm vào sẽ thổi phồng chỉ số sức khoẻ cổng.
     */
    FAILED,

    /**
     * Đơn quá hạn chờ thanh toán ({@code expires_at} đã qua mà khách không trả tiền).
     *
     * <p>Tách riêng khỏi {@link #FAILED} có chủ ý: khách không bấm trả tiền KHÔNG phải cổng
     * thanh toán lỗi. Trạng thái này không vào doanh thu và cũng KHÔNG vào tỉ lệ thất bại.
     */
    EXPIRED,

    /** Đơn bị huỷ chủ động — user tự huỷ, admin huỷ, hoặc bị thay bằng đơn mới. */
    CANCELLED,

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
