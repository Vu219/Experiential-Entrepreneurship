package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py LlmSpec — một lựa chọn model cụ thể trong llm_config.
 * Chứa API key PLAINTEXT gửi nội bộ backend→AI service (đã auth X-Internal-Token):
 * KHÔNG bao giờ log/toString payload này.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LlmSpecPayload {

    /** Mã provider chữ thường khớp llm_provider phía AI service: "anthropic" / "google". */
    String provider;

    String model;

    @JsonProperty("api_key")
    String apiKey;

    Double temperature;

    @JsonProperty("max_tokens")
    Integer maxTokens;
}
