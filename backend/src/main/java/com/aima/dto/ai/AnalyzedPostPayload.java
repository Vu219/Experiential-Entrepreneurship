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
 * Mirrors ai/src/schemas.py AnalyzedPost — một bài đã đăng kèm đặc điểm nội dung + số liệu
 * để AI tìm success factor (FR-63) và insight (FR-64).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AnalyzedPostPayload {

    @JsonProperty("post_id")
    String postId;

    String platform;

    @JsonProperty("scheduled_hour")
    Integer scheduledHour;

    String hook;

    String caption;

    List<String> hashtags;

    String cta;

    @JsonProperty("media_format")
    String mediaFormat;

    PostMetricsPayload metrics;
}
