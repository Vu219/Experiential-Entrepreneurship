package com.aima.content;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentStrategy;
import com.aima.entity.User;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentIdeaRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.TrendRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.AiUsageService;
import com.aima.service.NotificationService;
import com.aima.service.Impl.ContentGenerationWorkerServiceImpl;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Worker lưu ĐÚNG tên ErrorCode của lỗi chuỗi model (AiServiceClient đã map từ error_code của AI
 * service) vào job FAILED — FE dựa vào đó để hiện câu thân thiện (G).
 */
class ContentGenerationWorkerErrorCodeTest {

    @ParameterizedTest
    @EnumSource(value = ErrorCode.class, names = {
            "AI_PROVIDER_OVERLOADED", "AI_QUOTA_EXHAUSTED", "AI_TIMEOUT", "AI_BAD_REQUEST", "AI_UNAVAILABLE", "AI_SERVICE_ERROR"})
    @SuppressWarnings("unchecked")
    void failedAiCallStoresErrorCodeNameOnJob(ErrorCode code) {
        UUID jobId = UUID.randomUUID();
        User user = User.builder().email("u@aima.test").build();
        user.setId(UUID.randomUUID());
        BrandProfile brand = new BrandProfile();
        brand.setUser(user);
        ContentStrategy strategy = new ContentStrategy();
        strategy.setBrandProfile(brand);
        ContentGenerationJob job = new ContentGenerationJob();
        job.setId(jobId);
        job.setContentStrategy(strategy);
        job.setPlatform(Platform.FACEBOOK);
        job.setStatus(GenerationJobStatus.PENDING);

        ContentGenerationJobRepository jobRepository = mock(ContentGenerationJobRepository.class);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        AiServiceClient aiServiceClient = mock(AiServiceClient.class);
        when(aiServiceClient.generateContent(any())).thenThrow(new AppException(code));
        AiUsageService aiUsageService = mock(AiUsageService.class);
        when(aiUsageService.recordCall(any(), any())).thenAnswer(inv -> ((Supplier<?>) inv.getArgument(1)).get());
        TransactionTemplate tx = mock(TransactionTemplate.class);
        when(tx.execute(any())).thenAnswer(inv -> ((TransactionCallback<?>) inv.getArgument(0)).doInTransaction(null));
        doAnswer(inv -> {
            ((Consumer<Object>) inv.getArgument(0)).accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());

        ContentGenerationWorkerServiceImpl worker = new ContentGenerationWorkerServiceImpl(jobRepository,
                mock(ContentVersionRepository.class), mock(TrendRepository.class), mock(ContentIdeaRepository.class),
                aiServiceClient, mock(ContentItemMapper.class), mock(AiContentMapper.class), tx,
                mock(NotificationService.class), aiUsageService, mock(com.aima.service.ContentItemStatusResolver.class));

        worker.process(jobId);

        assertEquals(GenerationJobStatus.FAILED, job.getStatus());
        assertEquals(code.name(), job.getErrorCode());
        assertEquals(code.getMessage(), job.getErrorMessage());
    }
}
