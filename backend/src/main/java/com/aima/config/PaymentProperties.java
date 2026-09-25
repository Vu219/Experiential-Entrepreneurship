package com.aima.config;

import com.aima.enums.PaymentGateway;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình luồng thanh toán, độc lập với cổng cụ thể. Map từ block {@code payment.*} trong
 * application.yml. Tham số riêng của payOS nằm ở {@link PayOSProperties}.
 */
@ConfigurationProperties(prefix = "payment")
public record PaymentProperties(

        /** Cổng đang bật: {@code MOCK} (dev, không cần credential) hoặc {@code PAYOS}. */
        PaymentGateway gateway,

        /**
         * Hạn chờ thanh toán của một đơn PENDING. Dùng CHUNG cho đếm ngược phía user và
         * {@code expiredAt} gửi payOS — một mốc duy nhất, tính một lần lúc tạo đơn.
         */
        long pendingTtlMinutes,

        /** Mỗi lần gặp link {@code PROCESSING} thì gia hạn thêm bấy nhiêu phút (điểm B §5). */
        long graceMinutes,

        /** Trần số vòng ân hạn; vượt thì bật {@code reconcile_required} + báo admin. */
        int maxGraceRounds,

        /** Trần kích thước body webhook (byte) — endpoint webhook là public, không JWT. */
        int webhookMaxBodyBytes,

        /**
         * Số webhook bị từ chối vì SAI CHỮ KÝ trong {@link #webhookAlertWindowMinutes} đủ để
         * báo admin. Đây là lưới an toàn cho điểm mù chết người: nếu quy ước chữ ký của ta lệch
         * thì 100% webhook fail, khách trả tiền xong không được kích hoạt gói, mà tín hiệu duy
         * nhất lại là một dòng log ERROR.
         */
        int webhookAlertThreshold,

        /** Cửa sổ đếm cảnh báo (phút); cũng là khoảng chờ tối thiểu giữa hai lần báo admin. */
        long webhookAlertWindowMinutes
) {
}
