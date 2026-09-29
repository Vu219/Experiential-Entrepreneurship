package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Mirrors ai/src/schemas.py RegeneratePartResult — CHỈ chứa phần vừa tạo lại:
 * {@code section} cho HOOK/CTA, {@code steps} cho BODY. Nhánh không được yêu cầu để null.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RegeneratePartResultPayload implements TokenAccountedPayload {

    /** Dùng khi tạo lại HOOK/CTA — chỉ field được yêu cầu (content(+timing) hoặc scene_suggestion) có giá trị. */
    ScriptSectionPayload section;

    /** Dùng khi tạo lại BODY — mỗi bước chỉ mang field được yêu cầu. */
    List<ScriptStepPayload> steps;

    /** Token LLM thật của lần gọi (usage_metadata) — cộng vào quota tháng của user. */
    @JsonProperty("tokens_used")
    Long tokensUsed;

    @JsonProperty("input_tokens")
    Long inputTokens;

    @JsonProperty("output_tokens")
    Long outputTokens;

    @JsonProperty("cached_tokens")
    Long cachedTokens;

    /** Vết chuỗi fallback của AI service (model health — AiModelHealthService). */
    @JsonProperty("llm_attempts")
    List<LlmAttemptPayload> llmAttempts;
}
