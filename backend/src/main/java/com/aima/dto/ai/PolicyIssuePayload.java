package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Mirrors ai/src/schemas.py PolicyIssue — một vấn đề AI tìm thấy kèm gợi ý viết lại. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyIssuePayload {
    String excerpt;
    String reason;
    String suggestion;
}
