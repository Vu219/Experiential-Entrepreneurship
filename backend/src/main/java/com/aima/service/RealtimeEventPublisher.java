package com.aima.service;

import com.aima.enums.RealtimeEventType;

import java.util.UUID;

/**
 * Phát sự kiện realtime lên bus (Redis pub/sub kênh {@code aima:rt:v1}) — instance nào giữ kết nối SSE của người
 * nhận thì instance đó giao. <b>Best-effort</b>: lỗi chỉ log, không bao giờ phá luồng nghiệp vụ đang gọi.
 *
 * <p>Gọi TRONG transaction → phát SAU KHI commit (rollback = không phát); ngoài transaction → phát ngay.
 * SSE chỉ là gợi ý: DB vẫn là nguồn đúng (client resync / polling khi lỡ sự kiện).</p>
 */
public interface RealtimeEventPublisher {

    void toUser(UUID userId, RealtimeEventType type, Object payload);

    /** Như trên, kèm {@code id:} SSE cho sự kiện bền (id thông báo) để client nối lại bằng Last-Event-ID. */
    void toUser(UUID userId, RealtimeEventType type, String eventId, Object payload);

    void toAdmins(RealtimeEventType type, Object payload);

    /** Đóng mọi luồng SSE của user ở MỌI instance (đăng xuất, đổi mật khẩu, khoá tài khoản). */
    void revokeSessions(UUID userId);

    /** Lệnh nội bộ giữa các instance (không tới trình duyệt) — xử lý bởi {@link RealtimeControlHandler}. */
    void control(String command, Object payload);
}
