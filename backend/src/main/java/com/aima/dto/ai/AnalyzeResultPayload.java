package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py AnalyzeResult — kết quả POST {ai-service}/analyze. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AnalyzeResultPayload implements TokenAccountedPayload {

    @JsonProperty("success_factors")
    List<SuccessFactorPayload> successFactors;

    List<OptimizationInsightPayload> insights;

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
