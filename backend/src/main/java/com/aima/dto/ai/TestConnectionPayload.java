package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py TestConnectionInput — body sent to POST {ai-service}/test-connection.
 * Chứa API key PLAINTEXT gửi nội bộ backend→AI service: KHÔNG bao giờ log/toString payload này
 * (AiServiceClientImpl không log request body; phía Python không echo key trong response lỗi).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TestConnectionPayload {

    /** Mã provider chữ thường khớp llm_provider phía AI service: "anthropic" / "google". */
    String provider;

    String model;

    @JsonProperty("api_key")
    String apiKey;
}
