package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py CatalogModel — một model trong catalog provider trả về từ
 * POST /list-models (đã chuẩn hóa: field thiếu/0 = null). Provider KHÔNG trả giá.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CatalogModelPayload {

    String id;

    @JsonProperty("display_name")
    String displayName;

    @JsonProperty("max_input_tokens")
    Integer maxInputTokens;

    @JsonProperty("max_tokens")
    Integer maxTokens;
}
