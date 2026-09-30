package com.aima.service.Impl;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentGenerationJobResponse;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.User;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentGenerationJobMapper;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentGenerationService;
import com.aima.service.ContentGenerationWorkerService;
import com.aima.service.TokenUsageService;
import com.aima.util.RequestMeta;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ContentGenerationServiceImpl implements ContentGenerationService {

    ContentGenerationJobRepository contentGenerationJobRepository;
    ContentStrategyRepository contentStrategyRepository;
    ContentItemRepository contentItemRepository;
    UserRepository userRepository;
    ContentGenerationJobMapper contentGenerationJobMapper;
    ContentGenerationWorkerService contentGenerationWorkerService;
    TokenUsageService tokenUsageService;

    // Job đang chạy = còn chiếm chỗ chống trùng; SUCCESS/FAILED thì user tạo lại bình thường.
    private static final List<GenerationJobStatus> IN_FLIGHT = List.of(GenerationJobStatus.PENDING, GenerationJobStatus.RUNNING);
    private static final int IDEMPOTENCY_KEY_MAX_LENGTH = 64;

    // BR-01, BR-03, FR-13: chỉ chiến lược ACTIVE mới được tạo nội dung.
    @Override
    public ApiResponse<ContentGenerationJobResponse> startGeneration(String email, ContentGenerationRequest request,
                                                                     String idempotencyKey) {
        User user = currentUser(email);
        String key = normalizeIdempotencyKey(idempotencyKey);

        // Khoá row bài tới hết transaction → 2 request song song cho cùng bài chạy tuần tự,
        // nên hai bước chống trùng bên dưới không bị race (bấm đúp / client gửi lại).
        ContentItem item = contentItemRepository.findOwnedForUpdate(request.getContentItemId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));

        // Chống trùng #1: cùng Idempotency-Key → trả job cũ (kể cả đã xong) thay vì gọi AI lần nữa.
        if (key != null) {
            Optional<ContentGenerationJob> sameKey = contentGenerationJobRepository
                    .findFirstByIdempotencyKeyAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(key, user.getId());
            if (sameKey.isPresent()) {
                return existing(sameKey.get());
            }
        }
        // Chống trùng #2: đã có job PENDING/RUNNING cho cùng bài + nền tảng → trả job đó.
        Optional<ContentGenerationJob> inFlight = contentGenerationJobRepository
                .findFirstByContentItem_IdAndPlatformAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
                        item.getId(), request.getPlatform(), IN_FLIGHT);
        if (inFlight.isPresent()) {
            return existing(inFlight.get());
        }

        tokenUsageService.checkQuota(user); // hết hạn mức token tháng → chặn tạo job mới
        ContentStrategy strategy = contentStrategyRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(request.getStrategyId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND));

        if (strategy.getStatus() != StrategyStatus.ACTIVE) {
            throw new AppException(ErrorCode.STRATEGY_NOT_ACTIVE);
        }

        // B2: job ghi version vào MỘT bài có sẵn — bài phải thuộc user và còn trong wizard.
        if (!ContentItemServiceImpl.isWizardOpen(item)) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_DRAFT);
        }

        ContentGenerationJob job = contentGenerationJobMapper.toContentGenerationJob(request);
        job.setContentStrategy(strategy);
        job.setContentItem(item);
        job.setClientIp(RequestMeta.clientIp());
        job.setUserAgent(RequestMeta.userAgent());
        job.setIdempotencyKey(key);
        ContentGenerationJob saved = contentGenerationJobRepository.save(job);

        // Chỉ dispatch worker nền SAU KHI transaction commit — nếu không, thread @Async có thể
        // truy vấn job trước khi row này được ghi xuống DB (rule #24, cùng mẫu với
        // UserServiceImpl.scheduleOldAvatarDeletion).
        UUID jobId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    contentGenerationWorkerService.process(jobId);
                }
            });
        } else {
            contentGenerationWorkerService.process(jobId);
        }

        ContentGenerationJobResponse response = contentGenerationJobMapper.toResponse(saved);
        return ApiResponse.success("Đã bắt đầu tạo nội dung", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ContentGenerationJobResponse> getJob(String email, UUID jobId) {
        User user = currentUser(email);
        ContentGenerationJob job = contentGenerationJobRepository
                .findByIdAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(jobId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_GENERATION_JOB_NOT_FOUND));
        ContentGenerationJobResponse response = contentGenerationJobMapper.toResponse(job);
        return ApiResponse.success("Lấy trạng thái tác vụ tạo nội dung thành công", response);
    }

    private ApiResponse<ContentGenerationJobResponse> existing(ContentGenerationJob job) {
        log.info("[ContentGeneration] Trả lại job {} ({}) — chống tạo trùng", job.getId(), job.getStatus());
        return ApiResponse.success("Tác vụ tạo nội dung đã tồn tại", contentGenerationJobMapper.toResponse(job));
    }

    private static String normalizeIdempotencyKey(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String key = raw.trim();
        if (key.length() > IDEMPOTENCY_KEY_MAX_LENGTH) {
            throw new AppException(ErrorCode.IDEMPOTENCY_KEY_INVALID);
        }
        return key;
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
