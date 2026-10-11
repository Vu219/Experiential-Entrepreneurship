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
 * Mirrors ai/src/schemas.py PolicyFixRequest — body của POST {ai-service}/policy-fix. Chỉ gửi mã lỗi CHUẨN
 * ({@code errorCode}) + nghi vấn của bộ luật, KHÔNG gửi message thô của nền tảng.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyFixPayload implements LlmRoutedPayload {
    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;
    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;
    String platform;
    String caption;
    List<String> hashtags;
    @JsonProperty("error_code")
    String errorCode;
    @JsonProperty("rule_hits")
    List<RuleHitPayload> ruleHits;
}
