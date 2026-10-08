package com.aima.service.Impl;

import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentFormattingJobResponse;
import com.aima.dto.response.ContentVersionResponse;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentFormattingMapper;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentFormattingService;
import com.aima.service.ContentFormattingWorkerService;
import com.aima.service.TokenUsageService;
import com.aima.util.RequestMeta;
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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * FR-40..FR-46 (BR-04): định dạng một ContentItem thành ContentVersion theo từng nền tảng —
 * async job theo mẫu ContentGeneration (NFR-04, rule #28).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ContentFormattingServiceImpl implements ContentFormattingService {

    ContentFormattingJobRepository jobRepository;
    ContentItemRepository contentItemRepository;
    UserRepository userRepository;
    ContentFormattingMapper contentFormattingMapper;
    ContentFormattingWorkerService contentFormattingWorkerService;
    TokenUsageService tokenUsageService;
    PlatformTransactionManager transactionManager;

    // Job đang chạy = còn chiếm nền tảng của bài; SUCCESS/FAILED thì định dạng lại bình thường.
    private static final List<GenerationJobStatus> IN_FLIGHT = List.of(GenerationJobStatus.PENDING, GenerationJobStatus.RUNNING);

    @Override
    public ApiResponse<ContentFormattingJobResponse> startFormatting(String email, UUID itemId,
                                                                     ContentFormatRequest request) {
        User user = currentUser(email);
        // Khoá row bài tới hết transaction → hai request song song cho cùng bài chạy tuần tự, nên chống
        // trùng bên dưới không bị race (cùng mẫu ContentGeneration). Bài của hồ sơ đã xóa bị loại ở đây.
        ContentItem item = contentItemRepository.findOwnedForUpdate(itemId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));

        // Chống trùng theo (bài, nền tảng): job PENDING/RUNNING đã gồm MỌI nền tảng yêu cầu → trả job đó;
        // trùng MỘT PHẦN → chặn (trả job cũ sẽ lặng lẽ bỏ nền tảng mới, tạo job mới thì hai job cùng ghi một nền tảng).
        Set<Platform> requested = Set.copyOf(request.getPlatforms());
        for (ContentFormattingJob running : jobRepository
                .findByContentItem_IdAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(item.getId(), IN_FLIGHT)) {
            Set<Platform> busy = platformsOf(running);
            if (busy.containsAll(requested)) {
                log.info("[ContentFormatting] Trả lại job {} ({}) — chống tạo trùng", running.getId(), running.getStatus());
                ContentFormattingJobResponse existing = contentFormattingMapper.toJobResponse(running, currentVersions(item));
                return ApiResponse.success("Tác vụ định dạng nội dung đã tồn tại", existing);
            }
            if (!Collections.disjoint(busy, requested)) {
                throw new AppException(ErrorCode.CONTENT_FORMATTING_IN_PROGRESS);
            }
        }

        tokenUsageService.checkQuota(user); // hết hạn mức token tháng → chặn tạo job mới
        tokenUsageService.checkConcurrentAiJobs(user); // quá số tác vụ AI chạy song song → chặn

        // Định dạng (lại) được ở mọi trạng thái duyệt/lịch, TRỪ nền tảng đang đăng hoặc đã đăng: bản mới sẽ thay
        // bản cũ và nhận lại lịch chưa đăng của nó. Trạng thái tổng do worker cập nhật qua resolver.
        boolean publishedOrPosting = item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null && request.getPlatforms().contains(v.getPlatformName()))
                .map(ContentVersion::getPostSchedule)
                .anyMatch(s -> s != null && s.getDeletedAt() == null
                        && (s.getStatus() == ScheduleStatus.POSTING || s.getStatus() == ScheduleStatus.POSTED));
        if (publishedOrPosting) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_FORMATTABLE);
        }

        ContentFormattingJob job = contentFormattingMapper.toJob(item, request.getPlatforms());
        job.setClientIp(RequestMeta.clientIp());
        job.setUserAgent(RequestMeta.userAgent());
        ContentFormattingJob saved = jobRepository.save(job);

        // Dispatch worker nền SAU KHI transaction commit (rule #24/#28, cùng mẫu ContentGeneration).
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

        ContentFormattingJobResponse response = contentFormattingMapper.toJobResponse(saved, currentVersions(item));
        return ApiResponse.success("Đã bắt đầu định dạng nội dung theo nền tảng", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ContentFormattingJobResponse> getJob(String email, UUID jobId) {
        User user = currentUser(email);
        ContentFormattingJob job = jobRepository
                .findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(jobId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_FORMATTING_JOB_NOT_FOUND));
        ContentFormattingJobResponse response = contentFormattingMapper.toJobResponse(job, currentVersions(job.getContentItem()));
        return ApiResponse.success("Lấy trạng thái tác vụ định dạng nội dung thành công", response);
    }

    /**
     * Giao job cho worker. Hàng đợi executor đầy → {@link TaskRejectedException}: job sẽ không bao giờ chạy, nên
     * chốt FAILED ngay thay vì để PENDING + lỗi 500. Đang ở afterCommit (transaction cũ đã commit) nên ghi trong
     * transaction RIÊNG (REQUIRES_NEW) — REQUIRED sẽ nhập vào transaction đã xong và mất thay đổi.
     */
    private void dispatch(UUID jobId) {
        try {
            contentFormattingWorkerService.process(jobId);
        } catch (TaskRejectedException e) {
            log.error("[ContentFormatting] Hàng đợi worker đầy — chốt FAILED job {}", jobId, e);
            TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
            requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            requiresNew.executeWithoutResult(status -> jobRepository.findById(jobId).ifPresent(job -> {
                job.setStatus(GenerationJobStatus.FAILED);
                job.setErrorMessage(ErrorCode.AI_JOB_QUEUE_FULL.getMessage());
                jobRepository.save(job);
            }));
        }
    }

    // Cột platforms là CSV tên enum (mapper joinPlatforms); token lạ bỏ qua.
    private static Set<Platform> platformsOf(ContentFormattingJob job) {
        return Arrays.stream(job.getPlatforms().split(","))
                .map(String::trim)
                .filter(token -> Arrays.stream(Platform.values()).anyMatch(p -> p.name().equals(token)))
                .map(Platform::valueOf)
                .collect(Collectors.toSet());
    }

    // Các bản định dạng hiện hành (chưa xóa mềm) của item — bản cũ bị thay thế đã có deleted_at.
    private List<ContentVersionResponse> currentVersions(ContentItem item) {
        return item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null)
                .map(contentFormattingMapper::toContentVersionResponse)
                .toList();
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
