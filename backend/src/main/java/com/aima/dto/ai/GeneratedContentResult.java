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
 * Mirrors ai/src/schemas.py ContentItem — the body returned by POST {ai-service}/generate.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GeneratedContentResult implements TokenAccountedPayload {

    VideoScriptPayload script;

    String caption;

    List<String> hashtags;

    String cta;

    @JsonProperty("media_prompt")
    String mediaPrompt;

    /** Mô tả ẢNH TĨNH (schema Python để dành cho tính năng tạo ảnh — có thể rỗng). */
    @JsonProperty("image_prompt")
    String imagePrompt;

    /** FR-30: AI tự chấm brand voice — persist vào ContentVersion (voice_*). */
    @JsonProperty("brand_voice_check")
    BrandVoiceCheckPayload brandVoiceCheck;

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
