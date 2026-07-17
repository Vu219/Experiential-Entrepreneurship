package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py ListModelsRequest — body gửi POST {ai-service}/list-models.
 * Chứa API key PLAINTEXT gửi nội bộ backend→AI service: KHÔNG bao giờ log/toString payload này.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ListModelsPayload {

    /** Mã provider chữ thường khớp llm_provider phía AI service: "anthropic" / "google". */
    String provider;

    @JsonProperty("api_key")
    String apiKey;
}
