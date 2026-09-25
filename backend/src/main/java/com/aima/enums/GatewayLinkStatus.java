package com.aima.enums;

/**
 * Trạng thái của một payment link phía CỔNG thanh toán — khác với {@link PaymentStatus} là
 * trạng thái đơn hàng phía TA. Ánh xạ giữa hai bên nằm ở tầng service (bảng map trong
 * {@code docs/PAYMENT_PROGRESS.md} §3).
 *
 * <p>Bảy giá trị đầu lấy theo {@code PaymentLinkStatus} của SDK Go chính thức
 * ({@code payos-lib-golang/v2}). Trang tổng quan API của payOS ghi {@code SUCCEEDED} thay cho
 * {@code PAID} — <b>mâu thuẫn với SDK</b>; ta lấy theo SDK và fail-safe bằng {@link #UNKNOWN}.
 */
public enum GatewayLinkStatus {

    /** Đã tạo link, chờ khách chuyển tiền. */
    PENDING,

    /**
     * Tiền đang chuyển dở. <b>TUYỆT ĐỐI không huỷ link ở trạng thái này</b> — tiền sẽ về sau
     * khi đơn đã đóng. Job hết hạn phải gia hạn thay vì đóng đơn (điểm B §5).
     */
    PROCESSING,

    /** Đã thanh toán. Đường thành công DUY NHẤT — nhưng vẫn phải khớp tuyệt đối số tiền. */
    PAID,

    /**
     * Khách chuyển THIẾU. Cái bẫy lớn nhất của payOS: webhook vẫn báo {@code code="00"}
     * (một lệnh chuyển tiền thành công) dù đơn chưa đủ tiền → không bao giờ kích hoạt gói
     * chỉ dựa vào {@code code}.
     */
    UNDERPAID,

    CANCELLED,

    EXPIRED,

    /** Giao dịch hỏng thật sự — vế duy nhất vào tỉ lệ thất bại của cổng. */
    FAILED,

    /**
     * Giá trị cổng trả về mà ta không nhận ra (payOS thêm trạng thái mới, hoặc tài liệu và
     * SDK lệch nhau). Fail-safe: KHÔNG suy đoán, bật {@code reconcile_required} + log ERROR.
     */
    UNKNOWN;

    /** Chuỗi lạ/null → {@link #UNKNOWN} thay vì ném lỗi: cổng không được phép làm sập webhook. */
    public static GatewayLinkStatus from(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNKNOWN;
        }
        for (GatewayLinkStatus status : values()) {
            if (status != UNKNOWN && status.name().equalsIgnoreCase(raw.trim())) {
                return status;
            }
        }
        return UNKNOWN;
    }
}
