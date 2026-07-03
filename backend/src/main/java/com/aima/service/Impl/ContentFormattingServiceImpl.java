package com.aima.service.Impl;

import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentFormattingJobResponse;
import com.aima.dto.response.ContentVersionResponse;
import com.aima.entity.ContentFormattingJob;
import com.aima.entity.ContentItem;
import com.aima.entity.User;
import com.aima.enums.ContentLifecycle;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentFormattingMapper;
import com.aima.repository.ContentFormattingJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentFormattingService;
import com.aima.service.ContentFormattingWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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

    // Chỉ format nội dung đã sẵn sàng: GENERATED (luồng thường) hoặc APPROVED (luồng review).
    static final Set<ContentLifecycle> FORMATTABLE_STATUSES =
            EnumSet.of(ContentLifecycle.GENERATED, ContentLifecycle.APPROVED);

    ContentFormattingJobRepository jobRepository;
    ContentItemRepository contentItemRepository;
    UserRepository userRepository;
    ContentFormattingMapper contentFormattingMapper;
    ContentFormattingWorkerService contentFormattingWorkerService;

    @Override
    public ApiResponse<ContentFormattingJobResponse> startFormatting(String email, UUID itemId,
                                                                     ContentFormatRequest request) {
        User user = currentUser(email);
        ContentItem item = contentItemRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(itemId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));

        if (!FORMATTABLE_STATUSES.contains(item.getStatus())) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_FORMATTABLE);
        }

        ContentFormattingJob job = contentFormattingMapper.toJob(item, request.getPlatforms());
        ContentFormattingJob saved = jobRepository.save(job);

        // Dispatch worker nền SAU KHI transaction commit (rule #24/#28, cùng mẫu ContentGeneration).
        UUID jobId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    contentFormattingWorkerService.process(jobId);
                }
            });
        } else {
            contentFormattingWorkerService.process(jobId);
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
