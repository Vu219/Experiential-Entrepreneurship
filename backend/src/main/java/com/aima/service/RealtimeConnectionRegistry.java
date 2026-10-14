package com.aima.service;

import com.aima.dto.realtime.RealtimeMessage;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.UUID;

/**
 * Kết nối SSE đang mở trên INSTANCE NÀY (chỉ trong bộ nhớ). Instance khác có registry riêng; sự kiện tới được mọi
 * instance nhờ Redis pub/sub ({@link RealtimeEventPublisher}). Heartbeat {@code :hb}, giới hạn thời lượng và
 * dọn kết nối chết đều nằm ở đây — chạy trên MỌI instance, kể cả instance tắt {@code app.scheduling.enabled}.
 */
public interface RealtimeConnectionRegistry {

    /**
     * Mở kết nối mới. Quá {@code maxPerUser} → đóng kết nối cũ nhất của user bằng sự kiện {@code replaced};
     * quá {@code maxPerInstance} → {@code AppException(REALTIME_CAPACITY_EXCEEDED)}.
     *
     * @param deadline thời điểm server tự đóng (min(30 phút, access token hết hạn)) — client nối lại bằng cookie mới
     */
    Connection register(UUID userId, boolean admin, Instant deadline);

    /**
     * Giao một message nhận từ bus cho các kết nối local khớp đích (không chặn luồng gọi). Sự kiện
     * {@code session.revoked} được gửi rồi ĐÓNG kết nối (đăng xuất / khoá tài khoản / đổi mật khẩu).
     */
    void deliver(RealtimeMessage message);

    int connectionCount();

    /** Một kết nối SSE; gửi tuần tự theo thứ tự xếp hàng, lỗi ghi → tự gỡ khỏi registry. */
    interface Connection {
        UUID id();

        UUID userId();

        SseEmitter emitter();

        /** Xếp một sự kiện vào hàng gửi của kết nối này (thread-safe). */
        void send(String event, String id, String json);

        /** Gửi trường {@code retry:} (thời gian chờ nối lại gợi ý cho client) — gửi đầu tiên để proxy flush header. */
        void sendRetry(long millis);
    }
}
