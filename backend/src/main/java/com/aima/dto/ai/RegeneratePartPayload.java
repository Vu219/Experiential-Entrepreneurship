package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py RegeneratePartRequest — body của POST {ai-service}/regenerate-part.
 * Chỉ gửi phần cần tạo lại + toàn bộ script hiện tại (để AI giữ nhất quán và biết ngữ cảnh);
 * backend chỉ patch đúng nhánh vào DB, không dùng payload này để ghi đè nguyên script.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RegeneratePartPayload implements LlmRoutedPayload {

    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    String platform;

    /** "hook" | "body" | "cta". */
    String section;

    /** "content" | "scene". */
    String field;

    @JsonProperty("step_index")
    Integer stepIndex;

    @JsonProperty("current_script")
    VideoScriptPayload currentScript;
}
