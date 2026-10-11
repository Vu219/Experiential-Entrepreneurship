package com.aima.service.Impl;

import com.aima.dto.ai.PolicyCheckPayload;
import com.aima.dto.ai.PolicyCheckResultPayload;
import com.aima.dto.ai.PolicyFixPayload;
import com.aima.dto.ai.PolicyFixResultPayload;
import com.aima.dto.ai.RuleHitPayload;
import com.aima.entity.AiAssistJob;
import com.aima.entity.ContentVersion;
import com.aima.enums.AiAssistKind;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.mapper.AiAssistMapper;
import com.aima.mapper.AiContentMapper;
import com.aima.repository.AiAssistJobRepository;
import com.aima.service.AiAssistWorkerService;
import com.aima.service.AiServiceClient;
import com.aima.service.AiUsageService;
import com.aima.service.PolicyRuleEngine;
import com.aima.util.UserFacingErrors;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

/**
 * Worker nền cho {@code ai_assist_jobs} (rule #28, mẫu ContentRegeneration): TX ngắn #1 đánh dấu RUNNING + dựng
 * payload; gọi AI NGOÀI transaction qua {@link AiUsageService#recordCall} (token vào "Token AI tháng này", lỗi
 * không trừ); TX ngắn #2 lưu kết quả JSON. KHÔNG sửa bài — gợi ý chỉ được áp dụng khi người dùng bấm.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AiAssistWorkerServiceImpl implements AiAssistWorkerService {

    AiAssistJobRepository jobRepository;
    AiServiceClient aiServiceClient;
    AiUsageService aiUsageService;
    AiAssistMapper mapper;
    AiContentMapper aiContentMapper;
    PolicyRuleEngine ruleEngine;
    ObjectMapper objectMapper;
    TransactionTemplate transactionTemplate;

    /** Việc cần làm ngoài transaction: đúng một trong fix/check khác null. */
    private record Task(PolicyFixPayload fix, String originalCaption, List<String> originalHashtags,
                        PolicyCheckPayload check, AiUsageService.AiCallContext callContext) {
    }

    @Async("aiAssistExecutor")
    @Override
    public void process(UUID jobId) {
        Task task = transactionTemplate.execute(status -> markRunningAndBuild(jobId));
        if (task == null) {
            return;
        }
        try {
            String result;
            if (task.fix() != null) {
                PolicyFixResultPayload fix = aiUsageService.recordCall(task.callContext(),
                        () -> aiServiceClient.policyFix(task.fix()));
                result = objectMapper.writeValueAsString(
                        mapper.toSuggestion(fix, task.originalCaption(), task.originalHashtags()));
            } else {
                PolicyCheckResultPayload check = aiUsageService.recordCall(task.callContext(),
                        () -> aiServiceClient.policyCheck(task.check()));
                result = objectMapper.writeValueAsString(mapper.toAssessment(check));
            }
            transactionTemplate.executeWithoutResult(status -> finish(jobId, GenerationJobStatus.SUCCESS, result, null));
        } catch (Exception e) {
            String message = UserFacingErrors.messageOf(e); // không lộ chuỗi kỹ thuật — e vẫn được log đủ
            log.warn("[AiAssist] Job {} thất bại: {}", jobId, message, e);
            transactionTemplate.executeWithoutResult(status -> finish(jobId, GenerationJobStatus.FAILED, null, message));
        }
    }

    private Task markRunningAndBuild(UUID jobId) {
        AiAssistJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null || job.getStatus() != GenerationJobStatus.PENDING) {
            log.warn("[AiAssist] Job {} không tồn tại hoặc không còn PENDING — bỏ qua", jobId);
            return null;
        }
        ContentVersion version = job.getContentVersion();
        if (version == null || version.getDeletedAt() != null) {
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage("Bản nội dung không còn tồn tại");
            jobRepository.save(job);
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);

        String caption = version.getFormattedCaption() == null ? "" : version.getFormattedCaption();
        List<String> hashtags = AiAssistServiceImpl.hashtags(version);
        List<RuleHitPayload> hits = mapper.toRuleHitPayloads(ruleEngine.check(AiAssistServiceImpl.message(version)));
        if (job.getKind() == AiAssistKind.POLICY_FIX) {
            PolicyFixPayload payload = mapper.toFixPayload(
                    aiContentMapper.toBrandProfilePayload(version.getContentItem().getBrandProfile()),
                    version.getPlatformName(), caption, hashtags, job.getErrorCode(), hits);
            return new Task(payload, caption, hashtags, null, context(job, AiTaskCode.POLICY_FIX));
        }
        PolicyCheckPayload payload = mapper.toCheckPayload(version.getPlatformName(), caption, hashtags, hits);
        return new Task(null, null, null, payload, context(job, AiTaskCode.POLICY_CHECK));
    }

    private AiUsageService.AiCallContext context(AiAssistJob job, AiTaskCode taskCode) {
        return AiUsageService.AiCallContext.of(job.getUser(), taskCode, job.getId(), job.getClientIp(), job.getUserAgent());
    }

    private void finish(UUID jobId, GenerationJobStatus status, String result, String errorMessage) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(status);
            job.setResult(result);
            job.setErrorMessage(errorMessage);
            jobRepository.save(job);
        });
    }
}
