package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình payOS. Map từ block {@code payos.*} trong application.yml.
 *
 * <p>{@link #clientId}/{@link #apiKey}/{@link #checksumKey} để TRỐNG khi chạy cổng giả lập.
 * Cố ý KHÔNG fail lúc khởi động (khác {@code AIMA_ENCRYPTION_KEY}): dev chạy
 * {@code PAYMENT_GATEWAY=mock} không có credential vẫn phải boot được. Thiếu credential sẽ
 * bị chặn lúc GỌI, bằng {@code PAYMENT_GATEWAY_NOT_CONFIGURED}.</p>
 *
 * <p><b>Không bao giờ log</b> {@link #apiKey}/{@link #checksumKey}.</p>
 */
@ConfigurationProperties(prefix = "payos")
public record PayOSProperties(

        String baseUrl,
        String clientId,
        String apiKey,
        String checksumKey,

        /**
         * Nơi payOS đưa TRÌNH DUYỆT về. Chỉ để hiển thị — query string payOS gắn vào đây
         * KHÔNG có chữ ký, tuyệt đối không dùng để kích hoạt gói.
         */
        String returnUrl,
        String cancelUrl,

        /**
         * Trần độ dài {@code description}. Tài liệu payOS ghi tối đa 9 ký tự với tài khoản
         * ngân hàng CHƯA liên kết payOS; 9 luôn hợp lệ nên đó là mặc định an toàn.
         */
        int descriptionMaxLength,

        /**
         * Timeout BẮT BUỘC và tường minh cho mọi lời gọi HTTP sang payOS. Không có nó thì một
         * lần cổng treo sẽ giữ thread MVC vô hạn.
         *
         * <p>Phân biệt rất quan trọng cho luồng tạo đơn: hết timeout nghĩa là ta <b>không
         * biết</b> link đã được tạo bên payOS hay chưa → đơn KHÔNG được set FAILED, mà bật
         * {@code reconcile_required} để job đối soát gọi {@code getPaymentLink} kết luận.</p>
         */
        long connectTimeoutSeconds,
        long readTimeoutSeconds
) {
}
