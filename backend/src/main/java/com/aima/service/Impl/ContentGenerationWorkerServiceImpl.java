package com.aima.service.Impl;

import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.TrendPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.NotificationType;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentIdeaRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.TrendRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentGenerationWorkerService;
import com.aima.service.NotificationService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

/**
 * Xử lý nền cho {@link ContentGenerationJob} (NFR-04).
 * <p>
 * Cuộc gọi AI (HTTP, có thể mất nhiều giây) chạy <b>ngoài</b> transaction DB — mỗi bước ghi DB
 * được bọc trong một transaction ngắn qua {@link TransactionTemplate} (rule #24). Nhờ đó trạng thái
 * {@code RUNNING} được commit ngay để client poll thấy, và không giữ DB connection trong lúc gọi AI.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ContentGenerationWorkerServiceImpl implements ContentGenerationWorkerService {

    ContentGenerationJobRepository jobRepository;
    ContentItemRepository contentItemRepository;
    TrendRepository trendRepository;
    ContentIdeaRepository contentIdeaRepository;
    AiServiceClient aiServiceClient;
    ContentItemMapper contentItemMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;
    NotificationService notificationService;

    @Async("contentGenerationExecutor")
    @Override
    public void process(UUID jobId) {
        // TX ngắn #1: đánh dấu RUNNING + dựng payload từ dữ liệu lazy, rồi commit.
        GenerateContentPayload payload = transactionTemplate.execute(status -> markRunningAndBuildPayload(jobId));
        if (payload == null) {
            return; // job không tồn tại / đã bị xóa
        }

        try {
            // Gọi AI NGOÀI transaction (rule #24) — không giữ DB connection trong lúc chờ HTTP.
            GeneratedContentResult result = aiServiceClient.generateContent(payload);
            // TX ngắn #2: lưu ContentItem + gắn kết quả vào job.
            transactionTemplate.executeWithoutResult(status -> saveSuccess(jobId, result));
        } catch (Exception e) {
            // AppException giờ truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
            String message = e.getMessage();
            log.warn("[ContentGeneration] Job {} thất bại: {}", jobId, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(jobId, message));
        }
    }

    private GenerateContentPayload markRunningAndBuildPayload(UUID jobId) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentGeneration] Job {} không tồn tại khi bắt đầu xử lý", jobId);
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);

        ContentStrategy strategy = job.getContentStrategy();
        BrandProfile brand = strategy.getBrandProfile();
        UUID userId = brand.getUser().getId();
        return GenerateContentPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(brand))
                .strategy(aiContentMapper.toStrategyPayload(strategy))
                .platform(job.getPlatform().name())
                .trend(resolveTrend(job.getTrendId(), userId))
                .idea(resolveIdea(job.getIdeaId(), userId))
                .topic(job.getTopic())
                .note(job.getNote())
                .regenerateFrom(job.getRegenerateFrom())
                .build();
    }

    // Trend/idea gắn kèm resolve "mềm": id null → bỏ qua; id không tồn tại / không thuộc user
    // (chống gắn id của người khác) → log + bỏ qua, KHÔNG làm hỏng job. Python nhận null = None.
    private TrendPayload resolveTrend(UUID trendId, UUID userId) {
        if (trendId == null) {
            return null;
        }
        return trendRepository.findByIdAndResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(trendId, userId)
                .map(aiContentMapper::toTrendPayload)
                .orElseGet(() -> {
                    log.warn("[ContentGeneration] Trend {} không tồn tại hoặc không thuộc user — bỏ qua", trendId);
                    return null;
                });
    }

    private ContentIdeaPayload resolveIdea(UUID ideaId, UUID userId) {
        if (ideaId == null) {
            return null;
        }
        return contentIdeaRepository
                .findByIdAndTrend_ResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(ideaId, userId)
                .map(aiContentMapper::toContentIdeaPayload)
                .orElseGet(() -> {
                    log.warn("[ContentGeneration] ContentIdea {} không tồn tại hoặc không thuộc user — bỏ qua", ideaId);
                    return null;
                });
    }

    private void saveSuccess(UUID jobId, GeneratedContentResult result) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentGeneration] Job {} biến mất trước khi lưu kết quả", jobId);
            return;
        }
        ContentItem item = contentItemMapper.toContentItem(result);
        BrandProfile brand = job.getContentStrategy().getBrandProfile();
        item.setBrandProfile(brand);
        contentItemRepository.save(item);
        job.setResultContentItem(item);
        job.setStatus(GenerationJobStatus.SUCCESS);
        jobRepository.save(job);

        // FR-77: nội dung mới do AI tạo — nhắc user xem và duyệt trước khi lên lịch.
        notificationService.notify(brand.getUser(), NotificationType.REVIEW_NEEDED,
                "Nội dung mới cần xem xét",
                "AI vừa tạo nội dung mới cho thương hiệu " + brand.getBrandName()
                        + ". Hãy xem và duyệt trước khi định dạng/lên lịch đăng.",
                item.getId());
    }

    private void saveFailure(UUID jobId, String message) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        job.setStatus(GenerationJobStatus.FAILED);
        job.setErrorMessage(message);
        jobRepository.save(job);
    }
}
