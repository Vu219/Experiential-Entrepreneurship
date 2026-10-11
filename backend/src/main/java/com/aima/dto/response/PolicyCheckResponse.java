package com.aima.dto.response;

import com.aima.enums.PolicyCheckAiStatus;
import com.aima.enums.PolicyRiskLevel;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/**
 * Kết quả kiểm tra chính sách (CHỈ cảnh báo): tầng luật miễn phí + trạng thái/kết quả tầng AI. FE gọi lại khi
 * {@code aiStatus} PENDING/RUNNING để lấy kết quả (cache theo hash nội dung — không tạo job mới).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyCheckResponse {
    UUID contentVersionId;
    String contentHash;
    boolean enabled;
    PolicyRiskLevel ruleRisk;
    List<PolicyRuleHitResponse> ruleHits;
    PolicyCheckAiStatus aiStatus;
    UUID jobId;
    PolicyAiAssessmentResponse ai;
    long aiChecksUsed;
    Long aiChecksLimit;
}
