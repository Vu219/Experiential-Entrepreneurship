package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py GoldenHourRequest — body sent to POST {ai-service}/golden-hours (FR-48).
 * `posts` is omitted until analytics collection (FR-59) exists — the AI service then falls back to
 * platform defaults (data_driven = false).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GoldenHourPayload {

    String platform;
}
