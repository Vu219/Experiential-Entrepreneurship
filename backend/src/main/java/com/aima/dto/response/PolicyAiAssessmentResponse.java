package com.aima.dto.response;

import com.aima.enums.PolicyRiskLevel;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Kết quả tầng AI của kiểm tra chính sách (lưu JSON ở ai_assist_jobs.result). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyAiAssessmentResponse {
    PolicyRiskLevel riskLevel;
    String summary;
    List<PolicyIssueResponse> issues;
}
