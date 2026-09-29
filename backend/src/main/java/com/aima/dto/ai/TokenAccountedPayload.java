package com.aima.dto.ai;

/**
 * Payload kết quả AI có kèm token accounting (mirror TokenAccounting phía ai/src/schemas.py).
 * Worker đưa thẳng payload vào {@code AiUsageService.record} — mọi field null khi AI service
 * cũ chưa trả breakdown (backward compatible).
 */
public interface TokenAccountedPayload {

    /** Tổng token LLM thật của lần gọi (usage_metadata). */
    Long getTokensUsed();

    Long getInputTokens();

    Long getOutputTokens();

    /** Phần input đọc từ prompt cache (0/null nếu provider không báo). */
    Long getCachedTokens();

    /** Vết từng model đã thử (llm_attempts) — null với AI service bản cũ. */
    java.util.List<LlmAttemptPayload> getLlmAttempts();
}
