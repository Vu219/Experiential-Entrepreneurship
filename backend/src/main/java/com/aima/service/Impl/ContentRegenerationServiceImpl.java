package com.aima.service.Impl;

import com.aima.dto.common.VideoScriptDto;
import com.aima.dto.request.RegeneratePartRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentRegenerationJobResponse;
import com.aima.dto.response.ScriptPartPatch;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentRegenerationJob;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.RegenSection;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentRegenerationJobMapper;
import com.aima.repository.ContentRegenerationJobRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentRegenerationService;
import com.aima.service.ContentRegenerationWorkerService;
import com.aima.service.TokenUsageService;
import com.aima.util.RequestMeta;
import com.aima.util.ScriptJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ContentRegenerationServiceImpl implements ContentRegenerationService {

    UserRepository userRepository;
    ContentVersionRepository contentVersionRepository;
    ContentRegenerationJobRepository jobRepository;
    ContentRegenerationJobMapper jobMapper;
    ContentRegenerationWorkerService workerService;
    TokenUsageService tokenUsageService;
    ObjectMapper objectMapper;
    PlatformTransactionManager transactionManager;

    @Override
    public ApiResponse<ContentRegenerationJobResponse> startRegeneration(String email, UUID itemId, UUID versionId,
                                                                         RegeneratePartRequest request) {
        User user = currentUser(email);
        tokenUsageService.checkQuota(user); // hết hạn mức token tháng → chặn tạo job mới
        tokenUsageService.checkConcurrentAiJobs(user); // quá số tác vụ AI chạy song song → chặn
        // Version phải thuộc user (qua item → brand profile → user) và đúng bài trên path.
        ContentVersion version = contentVersionRepository
                .findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(versionId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));
        ContentItem item = version.getContentItem();
        // Bài / hồ sơ thương hiệu đã xóa mềm → bản coi như không tồn tại.
        if (item == null || !item.getId().equals(itemId) || item.getDeletedAt() != null
                || item.getBrandProfile().getDeletedAt() != null) {
            throw new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND);
        }
        // Chỉ tạo lại được khi bản còn sửa được (khớp FR-33: chỉ lúc đang đăng mới khóa).
        if (ContentItemServiceImpl.isPostingLocked(version)) {
            throw new AppException(ErrorCode.CONTENT_VERSION_POSTING_LOCKED);
        }
        // Tạo lại một bước cụ thể → bước đó phải tồn tại trong script hiện tại.
        if (request.getSection() == RegenSection.BODY && request.getStepIndex() != null) {
            VideoScriptDto script = ScriptJson.parse(version.getScript());
            boolean exists = script != null && script.getSteps() != null
                    && script.getSteps().stream().anyMatch(s -> request.getStepIndex().equals(s.getIndex()));
            if (!exists) {
                throw new AppException(ErrorCode.REGEN_STEP_NOT_FOUND);
            }
        }

        ContentRegenerationJob job = jobMapper.toRegenerationJob(request);
        job.setContentVersion(version);
        job.setClientIp(RequestMeta.clientIp());
        job.setUserAgent(RequestMeta.userAgent());
        ContentRegenerationJob saved = jobRepository.save(job);

        // Dispatch worker nền SAU KHI commit (rule #24/#28) — tránh @Async đọc job trước khi ghi xong.
        UUID jobId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(jobId);
                }
            });
        } else {
            dispatch(jobId);
        }

        ContentRegenerationJobResponse response = jobMapper.toResponse(saved);
        return ApiResponse.success("Đã bắt đầu tạo lại phần nội dung", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ContentRegenerationJobResponse> getJob(String email, UUID jobId) {
        User user = currentUser(email);
        ContentRegenerationJob job = jobRepository
                .findByIdAndContentVersion_ContentItem_BrandProfile_User_IdAndDeletedAtIsNull(jobId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_REGENERATION_JOB_NOT_FOUND));

        ContentRegenerationJobResponse response = jobMapper.toResponse(job);
        if (job.getStatus() == GenerationJobStatus.SUCCESS && job.getResultPatch() != null) {
            response.setPatch(parsePatch(job.getResultPatch()));
        }
        return ApiResponse.success("Lấy trạng thái tác vụ tạo lại thành công", response);
    }

    /**
     * Giao job cho worker. Hàng đợi executor đầy → {@link TaskRejectedException}: chốt FAILED ngay thay vì để
     * PENDING + lỗi 500. Đang ở afterCommit nên ghi trong transaction RIÊNG (REQUIRES_NEW).
     */
    private void dispatch(UUID jobId) {
        try {
            workerService.process(jobId);
        } catch (TaskRejectedException e) {
            log.error("[ContentRegen] Hàng đợi worker đầy — chốt FAILED job {}", jobId, e);
            TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
            requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            requiresNew.executeWithoutResult(status -> jobRepository.findById(jobId).ifPresent(job -> {
                job.setStatus(GenerationJobStatus.FAILED);
                job.setErrorMessage(ErrorCode.AI_JOB_QUEUE_FULL.getMessage());
                jobRepository.save(job);
            }));
        }
    }

    private ScriptPartPatch parsePatch(String raw) {
        try {
            return objectMapper.readValue(raw, ScriptPartPatch.class);
        } catch (Exception e) {
            log.warn("[ContentRegen] Không đọc được resultPatch: {}", e.getMessage());
            return null;
        }
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
