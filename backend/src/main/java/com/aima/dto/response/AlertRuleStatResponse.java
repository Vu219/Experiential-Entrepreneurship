package com.aima.dto.response;

import com.aima.enums.UsageAlertRule;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Báo cáo đo báo nhầm MỘT rule: tổng alert / số đánh dấu false positive / tỉ lệ % —
 * căn cứ quyết định rule nào đủ chín để sang pha 5B (tự động chặn).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AlertRuleStatResponse {

    UsageAlertRule ruleCode;

    Long total;

    Long falsePositives;

    /** % = falsePositives/total làm tròn; null khi total = 0. */
    Long falsePositivePct;
}
