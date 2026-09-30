package com.aima.content;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentGenerationJobResponse;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.User;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentGenerationJobMapper;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentGenerationWorkerService;
import com.aima.service.TokenUsageService;
import com.aima.service.Impl.ContentGenerationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Chống tạo trùng job generate: cùng Idempotency-Key → job cũ; job PENDING/RUNNING cùng
 * (bài, nền tảng) → job đó; job đã SUCCESS/FAILED không chặn tạo lại.
 */
class ContentGenerationDedupeTest {

    private ContentGenerationJobRepository jobRepository;
    private ContentItemRepository itemRepository;
    private ContentStrategyRepository strategyRepository;
    private ContentGenerationWorkerService worker;
    private TokenUsageService tokenUsageService;
    private ContentGenerationServiceImpl service;

    private User user;
    private ContentItem item;
    private ContentStrategy strategy;

    @BeforeEach
    void setUp() {
        jobRepository = mock(ContentGenerationJobRepository.class);
        itemRepository = mock(ContentItemRepository.class);
        strategyRepository = mock(ContentStrategyRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        worker = mock(ContentGenerationWorkerService.class);
        tokenUsageService = mock(TokenUsageService.class);
        ContentGenerationJobMapper mapper = mock(ContentGenerationJobMapper.class);

        user = User.builder().email("u@aima.test").build();
        user.setId(UUID.randomUUID());
        item = new ContentItem();
        item.setId(UUID.randomUUID());
        item.applyResolvedStatus(ContentItemStatus.DRAFT);
        strategy = new ContentStrategy();
        strategy.setId(UUID.randomUUID());
        strategy.setStatus(StrategyStatus.ACTIVE);

        when(userRepository.findByEmail("u@aima.test")).thenReturn(Optional.of(user));
        when(itemRepository.findOwnedForUpdate(item.getId(), user.getId())).thenReturn(Optional.of(item));
        when(strategyRepository.findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(strategy.getId(), user.getId()))
                .thenReturn(Optional.of(strategy));
        when(jobRepository.findFirstByIdempotencyKeyAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(any(), any()))
                .thenReturn(Optional.empty());
        when(jobRepository.findFirstByContentItem_IdAndPlatformAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
                any(), any(), anyCollection())).thenReturn(Optional.empty());
        when(jobRepository.save(any())).thenAnswer(inv -> {
            ContentGenerationJob j = inv.getArgument(0);
            j.setId(UUID.randomUUID());
            return j;
        });
        when(mapper.toContentGenerationJob(any())).thenAnswer(inv -> {
            ContentGenerationJob j = new ContentGenerationJob();
            j.setPlatform(((ContentGenerationRequest) inv.getArgument(0)).getPlatform());
            return j;
        });
        when(mapper.toResponse(any())).thenAnswer(inv -> {
            ContentGenerationJob j = inv.getArgument(0);
            return ContentGenerationJobResponse.builder().id(j.getId()).status(j.getStatus()).build();
        });

        service = new ContentGenerationServiceImpl(jobRepository, strategyRepository, itemRepository,
                userRepository, mapper, worker, tokenUsageService);
    }

    private ContentGenerationRequest request() {
        ContentGenerationRequest r = new ContentGenerationRequest();
        r.setStrategyId(strategy.getId());
        r.setContentItemId(item.getId());
        r.setPlatform(Platform.FACEBOOK);
        return r;
    }

    private ContentGenerationJob job(GenerationJobStatus status) {
        ContentGenerationJob j = new ContentGenerationJob();
        j.setId(UUID.randomUUID());
        j.setStatus(status);
        return j;
    }

    @Test
    void newKey_createsJobStoresKeyAndDispatchesWorker() {
        ApiResponse<ContentGenerationJobResponse> res = service.startGeneration("u@aima.test", request(), " key-1 ");

        verify(jobRepository).save(argThat(j -> "key-1".equals(j.getIdempotencyKey())));
        verify(worker).process(res.getResult().getId());
        verify(tokenUsageService).checkQuota(user);
    }

    @Test
    void sameKey_returnsExistingJob_withoutNewJobOrAiCall() {
        ContentGenerationJob done = job(GenerationJobStatus.SUCCESS);
        when(jobRepository.findFirstByIdempotencyKeyAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(
                "key-1", user.getId())).thenReturn(Optional.of(done));

        ApiResponse<ContentGenerationJobResponse> res = service.startGeneration("u@aima.test", request(), "key-1");

        assertEquals(done.getId(), res.getResult().getId());
        verify(jobRepository, never()).save(any());
        verifyNoInteractions(worker);
    }

    @Test
    void inFlightJobForSameItemAndPlatform_isReturned() {
        ContentGenerationJob running = job(GenerationJobStatus.RUNNING);
        when(jobRepository.findFirstByContentItem_IdAndPlatformAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
                eq(item.getId()), eq(Platform.FACEBOOK), argThat(s -> s.contains(GenerationJobStatus.PENDING)
                        && s.contains(GenerationJobStatus.RUNNING) && s.size() == 2)))
                .thenReturn(Optional.of(running));

        ApiResponse<ContentGenerationJobResponse> res = service.startGeneration("u@aima.test", request(), "key-2");

        assertEquals(running.getId(), res.getResult().getId());
        verify(jobRepository, never()).save(any());
        verifyNoInteractions(worker);
    }

    @Test
    void finishedJobsDoNotBlock_newKeyCreatesNewJob() {
        // Query in-flight chỉ hỏi PENDING/RUNNING → job SUCCESS/FAILED trước đó không được trả về.
        ApiResponse<ContentGenerationJobResponse> res = service.startGeneration("u@aima.test", request(), null);

        assertNotNull(res.getResult().getId());
        verify(jobRepository).save(argThat(j -> j.getIdempotencyKey() == null));
        verify(worker).process(any());
    }

    @Test
    void tooLongKey_rejected() {
        AppException e = assertThrows(AppException.class,
                () -> service.startGeneration("u@aima.test", request(), "x".repeat(65)));
        assertEquals(ErrorCode.IDEMPOTENCY_KEY_INVALID, e.getErrorCode());
    }
}
