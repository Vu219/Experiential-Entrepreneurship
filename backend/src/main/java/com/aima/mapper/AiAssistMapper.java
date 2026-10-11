package com.aima.mapper;

import com.aima.dto.ai.BrandProfileInputPayload;
import com.aima.dto.ai.PolicyCheckPayload;
import com.aima.dto.ai.PolicyCheckResultPayload;
import com.aima.dto.ai.PolicyFixPayload;
import com.aima.dto.ai.PolicyFixResultPayload;
import com.aima.dto.ai.PolicyIssuePayload;
import com.aima.dto.ai.RuleHitPayload;
import com.aima.dto.response.AiAssistJobResponse;
import com.aima.dto.response.AiAssistUsageResponse;
import com.aima.dto.response.AiFixApplyResponse;
import com.aima.dto.response.AiFixSuggestionResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.PolicyAiAssessmentResponse;
import com.aima.dto.response.PolicyCheckResponse;
import com.aima.dto.response.PolicyIssueResponse;
import com.aima.dto.response.PolicyRuleHitResponse;
import com.aima.entity.AiAssistJob;
import com.aima.entity.ContentVersion;
import com.aima.entity.Post;
import com.aima.entity.User;
import com.aima.enums.AiAssistKind;
import com.aima.enums.Platform;
import com.aima.enums.PolicyCheckAiStatus;
import com.aima.enums.PolicyRiskLevel;
import com.aima.enums.PublishErrorCode;
import com.aima.service.PlanLimitService;
import com.aima.service.PolicyRuleEngine;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Mapper cho AI hỗ trợ chính sách (failed-posts đợt 2): job ↔ response, nghi vấn bộ luật ↔ payload AI / response,
 * kết quả AI → JSON lưu trong {@code ai_assist_jobs.result}.
 */
@Mapper(componentModel = "spring")
public interface AiAssistMapper {

    PolicyRuleHitResponse toHitResponse(PolicyRuleEngine.Hit hit);

    List<PolicyRuleHitResponse> toHitResponses(List<PolicyRuleEngine.Hit> hits);

    RuleHitPayload toRuleHitPayload(PolicyRuleEngine.Hit hit);

    List<RuleHitPayload> toRuleHitPayloads(List<PolicyRuleEngine.Hit> hits);

    PolicyIssueResponse toIssueResponse(PolicyIssuePayload issue);

    List<PolicyIssueResponse> toIssueResponses(List<PolicyIssuePayload> issues);

    /** Job mới (PENDING) — nền tảng lấy từ bản nền tảng. */
    default AiAssistJob toJob(User user, ContentVersion version, Post post, AiAssistKind kind,
                              PublishErrorCode errorCode, String contentHash, String inputCaption,
                              String clientIp, String userAgent) {
        AiAssistJob job = new AiAssistJob();
        job.setUser(user);
        job.setContentVersion(version);
        job.setPost(post);
        job.setKind(kind);
        job.setPlatform(version.getPlatformName());
        job.setErrorCode(errorCode);
        job.setContentHash(contentHash);
        job.setInputCaption(inputCaption);
        job.setClientIp(clientIp);
        job.setUserAgent(userAgent);
        return job;
    }

    default AiAssistJobResponse toJobResponse(AiAssistJob job, AiFixSuggestionResponse fix,
                                              PolicyAiAssessmentResponse check, boolean stale) {
        ContentVersion version = job.getContentVersion();
        return AiAssistJobResponse.builder()
                .id(job.getId())
                .kind(job.getKind())
                .status(job.getStatus())
                .contentVersionId(version == null ? null : version.getId())
                .contentItemId(version == null || version.getContentItem() == null ? null : version.getContentItem().getId())
                .postId(job.getPost() == null ? null : job.getPost().getId())
                .platform(job.getPlatform())
                .errorCode(job.getErrorCode())
                .errorMessage(job.getErrorMessage())
                .stale(stale)
                .appliedAt(job.getAppliedAt())
                .fix(fix)
                .check(check)
                .build();
    }

    default PolicyFixPayload toFixPayload(BrandProfileInputPayload brand, Platform platform, String caption,
                                          List<String> hashtags, PublishErrorCode errorCode, List<RuleHitPayload> hits) {
        return PolicyFixPayload.builder()
                .brandProfile(brand)
                .platform(platformName(platform))
                .caption(caption)
                .hashtags(hashtags)
                .errorCode(errorCode == null ? null : errorCode.name())
                .ruleHits(hits)
                .build();
    }

    default PolicyCheckPayload toCheckPayload(Platform platform, String caption, List<String> hashtags,
                                              List<RuleHitPayload> hits) {
        return PolicyCheckPayload.builder()
                .platform(platformName(platform))
                .caption(caption)
                .hashtags(hashtags)
                .ruleHits(hits)
                .build();
    }

    default AiFixSuggestionResponse toSuggestion(PolicyFixResultPayload result, String originalCaption,
                                                 List<String> originalHashtags) {
        return AiFixSuggestionResponse.builder()
                .originalCaption(originalCaption)
                .originalHashtags(originalHashtags)
                .caption(result.getCaption() == null ? "" : result.getCaption())
                .hashtags(result.getHashtags() == null ? List.of() : result.getHashtags())
                .changes(result.getChanges() == null ? List.of() : result.getChanges())
                .build();
    }

    default PolicyAiAssessmentResponse toAssessment(PolicyCheckResultPayload result) {
        return PolicyAiAssessmentResponse.builder()
                .riskLevel(riskOf(result.getRiskLevel()))
                .summary(result.getSummary())
                .issues(result.getIssues() == null ? List.of() : toIssueResponses(result.getIssues()))
                .build();
    }

    default PolicyCheckResponse toPolicyCheck(UUID contentVersionId, String contentHash, boolean enabled,
                                              List<PolicyRuleEngine.Hit> hits, PolicyCheckAiStatus aiStatus,
                                              UUID jobId, PolicyAiAssessmentResponse ai, long aiChecksUsed,
                                              Long aiChecksLimit) {
        return PolicyCheckResponse.builder()
                .contentVersionId(contentVersionId)
                .contentHash(contentHash)
                .enabled(enabled)
                .ruleRisk(PolicyRuleEngine.maxSeverity(hits))
                .ruleHits(toHitResponses(hits))
                .aiStatus(aiStatus)
                .jobId(jobId)
                .ai(ai)
                .aiChecksUsed(aiChecksUsed)
                .aiChecksLimit(aiChecksLimit)
                .build();
    }

    @Mapping(target = "policyCheckAiLimit", source = "limits.policyCheckAiMonthly")
    @Mapping(target = "aiFixMaxPerVersion", source = "limits.aiFixPerVersion")
    AiAssistUsageResponse toUsageResponse(PlanLimitService.PlanLimits limits, long policyCheckAiUsed, LocalDateTime resetAt);

    default AiFixApplyResponse toApplyResponse(ContentVersion version, FailedPostRetryResponse retry) {
        return AiFixApplyResponse.builder()
                .contentVersionId(version.getId())
                .contentItemId(version.getContentItem() == null ? null : version.getContentItem().getId())
                .retry(retry)
                .build();
    }

    /** "none|low|medium|high" của AI service → enum; giá trị lạ → MEDIUM (an toàn: vẫn cảnh báo). */
    default PolicyRiskLevel riskOf(String value) {
        if (value == null || value.isBlank()) {
            return PolicyRiskLevel.NONE;
        }
        try {
            return PolicyRiskLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return PolicyRiskLevel.MEDIUM;
        }
    }

    /** Tên nền tảng AI service mong đợi ("Facebook" / "Instagram" / "Threads"). */
    default String platformName(Platform platform) {
        if (platform == null) {
            return null;
        }
        String name = platform.name();
        return name.charAt(0) + name.substring(1).toLowerCase(Locale.ROOT);
    }
}
