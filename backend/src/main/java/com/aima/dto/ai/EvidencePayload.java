package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py Evidence — nguồn thật đứng sau một trend (source: web | google_trends |
 * calendar | youtube | instagram | threads). Lưu nguyên dạng JSON vào trends.evidence.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EvidencePayload {

    String title;

    String url;

    String source;
}
