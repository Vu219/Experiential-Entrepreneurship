package com.aima.enums;

/**
 * Kịch bản hỏng mà cổng GIẢ LẬP mô phỏng ({@code payment.mock-scenario}, chỉ môi trường dev).
 *
 * <p>Lý do tồn tại: logic đối soát (đơn treo, link chưa từng tạo, link đã hết hạn) là phần
 * <b>khó nhất và ít được chạy nhất</b> của luồng thanh toán. Không có mấy kịch bản này thì nó
 * chỉ được thực thi lần đầu tiên vào đúng lúc đang có sự cố thật với tiền thật.</p>
 */
public enum MockGatewayScenario {

    /** Đường thành công — mặc định. */
    NORMAL,

    /**
     * {@code createPaymentLink} timeout. Đơn ở lại PENDING, KHÔNG có {@code checkoutUrl},
     * {@code reconcile_required = true} — chính là kịch bản từng khoá cứng user khỏi việc mua.
     */
    CREATE_TIMEOUT,

    /** Cổng trả 5xx khi tạo link — cũng là "không kết luận được". */
    CREATE_SERVER_ERROR,

    /** {@code getPaymentLink} báo 404: link CHƯA TỪNG tồn tại → đơn treo được phép đóng. */
    GET_LINK_NOT_FOUND,

    /**
     * {@code getPaymentLink} không hỏi được (timeout/mạng). Đối soát phải ĐẾM VÒNG và giữ
     * nguyên đơn — tuyệt đối không đóng đơn khi chưa biết link có PAID hay không.
     */
    GET_UNREACHABLE,

    /** Link tra cứu ra trạng thái EXPIRED — đối soát phải đóng đơn theo trạng thái thật. */
    LINK_EXPIRED
}
