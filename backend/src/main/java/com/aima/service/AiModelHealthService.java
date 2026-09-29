package com.aima.service;

import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmConfigPayload;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Circuit breaker theo model (lưu Redis, dùng chung mọi instance): model vừa quá tải / bị
 * rate-limit / hết quota ngày bị đánh dấu nghỉ tới {@code until}, và bị bỏ khỏi chuỗi model gửi
 * sang AI service cho tới lúc đó. Nguồn dữ liệu: {@code llm_attempts} AI service trả về.
 *
 * <p><b>Fail-open:</b> Redis lỗi/không kết nối được → coi mọi model là khả dụng (log WARNING),
 * không bao giờ làm hỏng luồng gọi AI.</p>
 */
public interface AiModelHealthService {

    String STATE_COOLDOWN = "COOLDOWN";
    String STATE_EXHAUSTED = "EXHAUSTED";

    /** Trạng thái một model đang nghỉ. {@code until}/{@code updatedAt} theo giờ ứng dụng (APP_TIMEZONE). */
    record Entry(String provider, String model, String state, String reason, LocalDateTime until,
                 boolean freeTier, LocalDateTime updatedAt) {
    }

    /** Cập nhật từ vết chuỗi fallback: lỗi có cooldown → đánh dấu nghỉ; "ok" → xoá dấu (đã hồi). Best-effort. */
    void record(List<LlmAttemptPayload> attempts);

    /**
     * Bỏ các model đang nghỉ khỏi chuỗi (trả bản sao — không sửa object cache). Mọi model đều nghỉ,
     * config null, hoặc Redis lỗi → trả nguyên config (vẫn thử, AI service tự phân loại lỗi).
     */
    LlmConfigPayload filterAvailable(LlmConfigPayload config);

    /** Các model đang nghỉ (cho trang admin). Redis lỗi → danh sách rỗng. */
    List<Entry> list();

    /** Xoá dấu nghỉ của mọi model thuộc provider ("google"/"anthropic"); trả số model đã xoá. */
    int reset(String provider);
}
