package com.aima.dto.realtime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import tools.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Message trên kênh Redis {@code aima:rt:v1} — mọi instance nhận, chỉ giao cho kết nối SSE của chính mình.
 *
 * <p>Đích: {@code userId} (một user) HOẶC {@code role = "ADMIN"} (mọi admin). Message {@code control} không đi tới
 * trình duyệt mà điều khiển instance (vd huỷ job AI đang chạy ở instance khác — Bước 5).</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RealtimeMessage {

    public static final String ROLE_ADMIN = "ADMIN";

    /** Người nhận (null khi gửi theo role / control). */
    UUID userId;

    /** {@value #ROLE_ADMIN} = mọi kết nối của admin. */
    String role;

    /** Tên sự kiện SSE ({@code RealtimeEventType.wireName}) hoặc tên lệnh control. */
    String event;

    /** Trường {@code id:} của SSE — chỉ sự kiện bền (id thông báo) để client gửi lại Last-Event-ID. */
    String id;

    /** true = lệnh nội bộ giữa các instance, không giao cho trình duyệt. */
    Boolean control;

    /** Payload JSON của sự kiện (đã có {@code v} + {@code ts}). */
    JsonNode data;
}
