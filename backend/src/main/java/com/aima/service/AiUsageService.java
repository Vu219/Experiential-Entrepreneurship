package com.aima.service;

import com.aima.dto.ai.TokenAccountedPayload;
import com.aima.entity.User;
import com.aima.enums.AiTaskCode;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Event log {@code ai_usage} — ghi MỘT bản ghi cho MỖI lần gọi AI, kể cả lỗi/timeout.
 * Worker bọc cuộc gọi AI trong {@link #recordCall} (một chokepoint duy nhất: đo latency,
 * phân loại status, tính billable_units theo billing_rates, chống double-count qua
 * idempotency key). Ghi ở CẢ hai đường: config DB hiệu lực → provider/model thật;
 * đường env → provider/model UNKNOWN (event log vẫn đầy đủ 100%, chỉ thiếu chi phí).
 */
public interface AiUsageService {

    /**
     * Bọc một cuộc gọi AI: chạy {@code call}, ghi event usage rồi trả kết quả.
     * <ul>
     *   <li>Thành công → event SUCCESS (bỏ qua nếu không có token — vd endpoint không gọi LLM).</li>
     *   <li>Ném exception → event ERROR/TIMEOUT với input/output = NULL ("không biết",
     *       khác 0) và billable_units = 0 (không trừ hạn mức request lỗi), rồi NÉM LẠI
     *       exception gốc — luồng lỗi của worker giữ nguyên.</li>
     *   <li>Bản thân việc ghi event là best-effort: lỗi ghi chỉ log, không bao giờ ném ra.</li>
     * </ul>
     */
    <T extends TokenAccountedPayload> T recordCall(AiCallContext context, Supplier<T> call);

    /**
     * Ngữ cảnh MỘT cuộc gọi AI — dựng TRONG transaction ngắn của worker (lúc còn truy cập
     * lazy user/job), tiêu thụ NGOÀI transaction quanh HTTP call. {@code callLabel} phân biệt
     * nhiều cuộc gọi cùng task trong một job (vd "analyze"/"optimize"); {@code requestId}
     * = id job/session để correlation + idempotency.
     */
    record AiCallContext(UUID userId, AiTaskCode taskCode, UUID requestId, String callLabel,
                         String planCode, String clientIp, String userAgent) {

        public static AiCallContext of(User user, AiTaskCode taskCode, UUID requestId,
                                       String clientIp, String userAgent) {
            return new AiCallContext(user.getId(), taskCode, requestId, null,
                    user.getPlan() == null ? null : user.getPlan().name(), clientIp, userAgent);
        }

        /** Bản sao với nhãn phân biệt cuộc gọi (job có nhiều cuộc gọi AI cùng task). */
        public AiCallContext withLabel(String label) {
            return new AiCallContext(userId, taskCode, requestId, label, planCode, clientIp, userAgent);
        }
    }
}
