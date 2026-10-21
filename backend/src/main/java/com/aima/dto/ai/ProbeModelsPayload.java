package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Mirrors ai/src/schemas.py ProbeModelsRequest — các model cần "Kiểm tra model" (generateContent tối thiểu).
 * Chứa API key PLAINTEXT trong từng spec: KHÔNG log/toString payload này.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProbeModelsPayload {
    List<LlmSpecPayload> specs;
}
