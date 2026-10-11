package com.aima.dto.response;

import com.aima.enums.PolicyRiskLevel;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Nghi vấn của bộ luật miễn phí — FE dịch {@code category} thành câu (i18n), {@code excerpt} là đoạn gốc. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyRuleHitResponse {
    String ruleId;
    String category;
    PolicyRiskLevel severity;
    String excerpt;
}
