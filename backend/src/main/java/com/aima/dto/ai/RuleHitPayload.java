package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mirrors ai/src/schemas.py RuleHit — một nghi vấn của bộ luật miễn phí (tầng 1). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RuleHitPayload {
    String category;
    String severity;
    String excerpt;
}
