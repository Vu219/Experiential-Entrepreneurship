package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cấu hình luồng realtime SSE ({@code aima.realtime.*}) — xem docs/REALTIME_SSE_NOTIFICATIONS_PROPOSAL.md mục 1.
 *
 * @param bus                    {@code redis} (mặc định, đúng cho N instance: mọi sự kiện đi qua Redis pub/sub kể cả khi phát
 *                               cho chính instance mình) hoặc {@code local} (giao thẳng trong JVM — CHỈ cho test / chạy một instance)
 * @param channel                kênh Redis pub/sub duy nhất
 * @param heartbeatSeconds       chu kỳ comment {@code :hb} (phải nhỏ hơn timeout idle của proxy, Render ~60–100s)
 * @param maxConnectionMinutes   mỗi kết nối tối đa N phút rồi server gửi {@code reconnect} và đóng
 * @param maxPerUser             số kết nối tối đa của MỘT user trên MỘT instance (vượt → đóng kết nối cũ nhất bằng {@code replaced})
 * @param maxPerInstance         tổng kết nối tối đa của instance (vượt → 503 + Retry-After)
 * @param replayLimit            số thông báo phát bù tối đa khi nối lại bằng Last-Event-ID (quá → {@code ready.resync=true})
 * @param maxQueuedEvents        hàng đợi gửi của một kết nối; client đọc quá chậm → đóng kết nối (client nối lại + resync)
 */
@ConfigurationProperties(prefix = "aima.realtime")
public record RealtimeProperties(
        @DefaultValue("redis") String bus,
        @DefaultValue("aima:rt:v1") String channel,
        @DefaultValue("20") int heartbeatSeconds,
        @DefaultValue("30") int maxConnectionMinutes,
        @DefaultValue("6") int maxPerUser,
        @DefaultValue("2000") int maxPerInstance,
        @DefaultValue("50") int replayLimit,
        @DefaultValue("500") int maxQueuedEvents
) {
    public boolean redisBus() {
        return !"local".equalsIgnoreCase(bus);
    }
}
