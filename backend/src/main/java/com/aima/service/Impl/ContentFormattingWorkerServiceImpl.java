package com.aima.service.Impl;

import com.aima.dto.ai.ContentVersionPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentFormattingMapper;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentFormattingWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Xử lý nền cho {@link ContentFormattingJob} (NFR-04, FR-40..FR-46) — cùng mẫu
 * {@link ContentGenerationWorkerServiceImpl}: RUNNING commit ngay qua transaction ngắn,
 * cuộc gọi AI chạy NGOÀI transaction, kết quả/lỗi lưu trong transaction ngắn thứ hai.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ContentFormattingWorkerServiceImpl implements ContentFormattingWorkerService {

    ContentFormattingJobRepository jobRepository;
    AiServiceClient aiServiceClient;
    ContentFormattingMapper contentFormattingMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;

    @Async("contentFormattingExecutor")
    @Override
    public void process(UUID jobId) {
        FormatPayload payload = transactionTemplate.execute(status -> markRunningAndBuildPayload(jobId));
        if (payload == null) {
            return; // job không tồn tại / đã bị xóa
        }

        try {
            FormatResultPayload result = aiServiceClient.format(payload);
            transactionTemplate.executeWithoutResult(status -> saveSuccess(jobId, result));
        } catch (Exception e) {
            // AppException giờ truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
            String message = e.getMessage();
            log.warn("[ContentFormatting] Job {} thất bại: {}", jobId, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(jobId, message));
        }
    }

    private FormatPayload markRunningAndBuildPayload(UUID jobId) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentFormatting] Job {} không tồn tại khi bắt đầu xử lý", jobId);
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);

        ContentItem item = job.getContentItem();
        return FormatPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(item.getBrandProfile()))
                .content(contentFormattingMapper.toFormatContentPayload(item))
                .platforms(Arrays.stream(job.getPlatforms().split(",")).toList())
                .build();
    }

    private void saveSuccess(UUID jobId, FormatResultPayload result) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentFormatting] Job {} biến mất trước khi lưu kết quả", jobId);
            return;
        }

        ContentItem item = job.getContentItem();
        List<ContentVersionPayload> payloads = result.getVersions() == null ? List.of() : result.getVersions();
        Set<Platform> replaced = EnumSet.noneOf(Platform.class);

        List<ContentVersion> newVersions = payloads.stream().map(payload -> {
            ContentVersion version = contentFormattingMapper.toContentVersion(payload);
            version.setContentItem(item);
            replaced.add(version.getPlatformName());
            return version;
        }).toList();

        // FR-46: format lại → bản cũ cùng nền tảng bị thay thế bằng xóa mềm (rule #9), bản mới được thêm.
        item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null && replaced.contains(v.getPlatformName()))
                .forEach(v -> v.setDeletedAt(LocalDateTime.now()));
        item.getContentVersions().addAll(newVersions);

        item.setStatus(ContentLifecycle.FORMATTED);
        job.setStatus(GenerationJobStatus.SUCCESS);
        jobRepository.save(job); // item + versions lưu qua cascade từ item đang managed trong tx
    }

    private void saveFailure(UUID jobId, String message) {
        ContentFormattingJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        job.setStatus(GenerationJobStatus.FAILED);
        job.setErrorMessage(message);
        jobRepository.save(job);
    }
}
