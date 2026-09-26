package com.aima.enums;

import java.util.Set;

/**
 * Phương thức thanh toán user chọn ở trang "Xem lại đơn hàng". Mỗi phương thức chạy trên một
 * nhóm cổng ({@link PaymentGateway}); phương thức chỉ BẬT khi cổng đang cấu hình
 * ({@code payment.gateway}) thuộc nhóm đó.
 *
 * <p>Thêm phương thức mới = thêm một giá trị ở đây (+ bean {@code PaymentGatewayClient} nếu là
 * cổng mới) và một mục trong registry FE {@code config/paymentMethods.ts} — luồng checkout không
 * phải sửa.</p>
 */
public enum PaymentMethod {

    /** Chuyển khoản VietQR qua trang thanh toán payOS. MOCK là cổng giả lập của nó trên máy dev. */
    PAYOS_VIETQR(Set.of(PaymentGateway.PAYOS, PaymentGateway.MOCK));

    private final Set<PaymentGateway> gateways;

    PaymentMethod(Set<PaymentGateway> gateways) {
        this.gateways = gateways;
    }

    public boolean runsOn(PaymentGateway gateway) {
        return gateways.contains(gateway);
    }
}
