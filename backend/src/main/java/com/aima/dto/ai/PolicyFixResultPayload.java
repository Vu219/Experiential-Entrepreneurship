package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py PolicyFixResult — caption/hashtag gợi ý + các thay đổi (+ token accounting). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyFixResultPayload implements TokenAccountedPayload {
    String caption;
    List<String> hashtags;
    List<String> changes;
    @JsonProperty("tokens_used")
    Long tokensUsed;
    @JsonProperty("input_tokens")
    Long inputTokens;
    @JsonProperty("output_tokens")
    Long outputTokens;
    @JsonProperty("cached_tokens")
    Long cachedTokens;
    @JsonProperty("llm_attempts")
    List<LlmAttemptPayload> llmAttempts;
}
