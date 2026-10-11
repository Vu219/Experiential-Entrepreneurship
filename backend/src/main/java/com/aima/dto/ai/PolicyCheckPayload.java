package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Mirrors ai/src/schemas.py PolicyCheckRequest — body của POST {ai-service}/policy-check (tầng 2). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyCheckPayload implements LlmRoutedPayload {
    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;
    String platform;
    String caption;
    List<String> hashtags;
    @JsonProperty("rule_hits")
    List<RuleHitPayload> ruleHits;
}
