package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py PostMetrics. Field Python KHÔNG Optional (default 0) —
 * NON_NULL để metric nền tảng không cung cấp (null trong DB) được BỎ QUA thay vì gửi null
 * (null sẽ fail validation pydantic).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PostMetricsPayload {

    Long views;

    Long likes;

    Long comments;

    Long shares;

    Long saves;

    Double ctr;

    @JsonProperty("conversion_rate")
    Double conversionRate;

    @JsonProperty("watch_time")
    Long watchTime;
}
