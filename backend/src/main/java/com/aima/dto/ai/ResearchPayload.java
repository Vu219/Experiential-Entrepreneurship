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
 * Mirrors ai/src/schemas.py ResearchRequest — sent as the body of POST {ai-service}/research.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ResearchPayload implements LlmRoutedPayload {

    @JsonProperty("llm_config")
    LlmConfigPayload llmConfig;

    @JsonProperty("brand_profile")
    BrandProfileInputPayload brandProfile;

    ContentStrategyInputPayload strategy;

    // Nền tảng đích của phiên (FR-19) — AI chỉ trả trend/idea cho đúng nền tảng này.
    String platform;

    // Thị trường (ISO 3166) cho Google Trends / vị trí tìm kiếm; null = mặc định của AI service (VN).
    String region;

    // Trend các phiên gần đây cùng brand + nền tảng — momentum + tránh lặp (rejected = user đã xóa).
    @JsonProperty("previous_trends")
    List<PreviousTrendPayload> previousTrends;

    @JsonProperty("max_trends")
    Integer maxTrends;

    @JsonProperty("max_ideas")
    Integer maxIdeas;
}
