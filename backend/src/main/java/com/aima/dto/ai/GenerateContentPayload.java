package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py GenerateRequest — sent as the body of POST {ai-service}/generate.
 * trend/idea/note là Optional phía Python (None khi vắng) — backend chỉ gửi khi job có gắn
 * id và resolve được (đúng ownership); ngược lại để null.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GenerateContentPayload implements LlmRoutedPayload {

    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    ContentStrategyInputPayload strategy;

    String platform;

    /** Trend user gắn ở bước Chọn nguồn — NỘI DUNG đầy đủ đã resolve, không phải id. */
    TrendPayload trend;

    /** Ý tưởng content user gắn — NỘI DUNG đầy đủ đã resolve, không phải id. */
    ContentIdeaPayload idea;

    String topic;

    /** Ghi chú thêm của user (chỉ dẫn cho AI, khác topic là chủ đề). */
    String note;

    @JsonProperty("regenerate_from")
    String regenerateFrom;
}
