package com.aima.dto.realtime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Payload SSE {@code ai.delta} — một đoạn chữ AI vừa sinh cho field {@code path} (vd {@code caption},
 * {@code script.steps[1].content}), đã gộp mỗi ~100ms. Không có {@code id:} SSE, không phát bù: lỡ thì khung xem trước
 * chờ kết quả cuối từ DB.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiDeltaEvent {
    UUID jobId;
    /** Tăng dần trong một job — FE bỏ sự kiện tới trễ / trùng. */
    long seq;
    String path;
    String append;
    /** true = thay toàn bộ giá trị field (model sửa lại phần đã sinh). */
    Boolean replace;
}
