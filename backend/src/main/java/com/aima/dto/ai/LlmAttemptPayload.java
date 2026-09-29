package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Mirrors ai/src/schemas.py LlmAttempt — một bước của chuỗi fallback phía AI service.
 * {@code outcome} = "ok" hoặc loại lỗi đã phân loại (daily_quota_exhausted, rate_limited,
 * provider_overloaded, ...); {@code cooldownUntil} = gợi ý tới khi nào nên bỏ qua model này
 * (null = không cần nghỉ). Nguồn dữ liệu cho circuit breaker {@code AiModelHealthService}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LlmAttemptPayload {

    String provider;

    String model;

    String outcome;

    @JsonProperty("http_status")
    Integer httpStatus;

    @JsonProperty("retry_after_seconds")
    Double retryAfterSeconds;

    @JsonProperty("cooldown_until")
    Instant cooldownUntil;

    @JsonProperty("free_tier")
    Boolean freeTier;

    @JsonProperty("latency_ms")
    Long latencyMs;
}
