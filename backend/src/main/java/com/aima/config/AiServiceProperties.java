package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình gọi AI service (Python/FastAPI). Map từ block {@code ai-service.*} trong application.yml.
 */
@ConfigurationProperties(prefix = "ai-service")
public record AiServiceProperties(
        String baseUrl,
        long timeoutSeconds,
        // Trend research = tìm kiếm web + tổng hợp (2 lượt gọi model) → timeout riêng, dài hơn;
        // phải > TREND_SEARCH_BUDGET_SECONDS + LLM_CHAIN_BUDGET_SECONDS của AI service. ≤ 0 → dùng timeoutSeconds.
        long researchTimeoutSeconds,
        // Shared secret với AI service (header X-Internal-Token) — bắt buộc cho request
        // mang llm_config / test-connection. KHÔNG log giá trị này.
        String internalToken
) {

    public long effectiveResearchTimeoutSeconds() {
        return researchTimeoutSeconds > 0 ? researchTimeoutSeconds : timeoutSeconds;
    }
}
