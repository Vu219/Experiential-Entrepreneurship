package com.aima.service.Impl;

import java.util.Set;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashSet;
import reactor.core.publisher.Mono;
import org.springframework.beans.factory.annotation.Value;
import lombok.experimental.NonFinal;
import com.aima.service.RealtimeEventPublisher;
import com.aima.service.GenerationCancelService;
import com.aima.service.AiStreamListener;
import com.aima.mapper.RealtimeMapper;
import com.aima.exception.AiStreamCancelledException;
import com.aima.enums.RealtimeEventType;
import com.aima.service.JobEventService;
import com.aima.util.NotificationParams;
import com.aima.enums.NotificationRefType;
import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.TrendPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentGenerationJob;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.NotificationType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentIdeaRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.TrendRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.ContentGenerationWorkerService;
import com.aima.service.NotificationService;
import com.aima.service.AiUsageService;
import com.aima.util.UserFacingErrors;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
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
    ContentVersionRepository contentVersionRepository;
    TrendRepository trendRepository;
    ContentIdeaRepository contentIdeaRepository;
    AiServiceClient aiServiceClient;
    ContentItemMapper contentItemMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;
    NotificationService notificationService;
    AiUsageService aiUsageService;
    ContentItemStatusResolver statusResolver;
    JobEventService jobEventService;
    GenerationCancelService cancelService;
    RealtimeEventPublisher realtimeEventPublisher;
    RealtimeMapper realtimeMapper;

    /**
     * D11: AI trả nội dung từng đoạn (/generate/stream) — mặc định TẮT vì BE và AI service deploy riêng; tắt = đường
     * /generate cũ (vẫn huỷ được: kết quả về muộn của job đã huỷ bị bỏ).
     */
    @NonFinal
    @Value("${aima.ai.generation-streaming-enabled:false}")
    boolean streamingEnabled;

    /** Mốc tiến độ trong RUNNING (chỉ có trong sự kiện realtime, không lưu DB). */
    static final String STAGE_PREPARING = "PREPARING";
    static final String STAGE_GENERATING = "GENERATING";
    static final long DELTA_FLUSH_MS = 100;

    /** Payload + ngữ cảnh event usage, dựng trong TX ngắn #1 để dùng ngoài transaction. */
    private record GenerationTask(GenerateContentPayload payload, AiUsageService.AiCallContext callContext) {
    }

    @Async("contentGenerationExecutor")
    @Override
    public void process(UUID jobId) {
        // TX ngắn #1: đánh dấu RUNNING + dựng payload từ dữ liệu lazy, rồi commit.
        GenerationTask task = transactionTemplate.execute(status -> markRunningAndBuildPayload(jobId));
        if (task == null) {
            return; // job không tồn tại / đã bị xóa
        }

        jobEventService.generationUpdated(jobId, STAGE_GENERATING); // tiến độ realtime (transaction đọc ngắn riêng)
        try {
            // Gọi AI NGOÀI transaction (rule #24), bọc recordCall để ghi event usage (kể cả lỗi).
            GeneratedContentResult result = aiUsageService.recordCall(task.callContext(), () -> callAi(jobId, task));
            // TX ngắn #2: lưu ContentItem + gắn kết quả vào job.
            transactionTemplate.executeWithoutResult(status -> saveSuccess(jobId, result));
        } catch (AiStreamCancelledException e) {
            // User bấm Dừng: endpoint huỷ đã chốt job FAILED/CANCELLED_BY_USER + phát job.updated; usage CANCELLED đã ghi.
            log.info("[ContentGeneration] Job {} đã dừng theo yêu cầu user", jobId);
        } catch (Exception e) {
            // AppException giờ truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
            String message = UserFacingErrors.messageOf(e); // chuỗi kỹ thuật không lộ ra người dùng — e vẫn được log đủ
            ErrorCode code = e instanceof AppException app && app.getErrorCode() != null
                    ? app.getErrorCode() : ErrorCode.AI_SERVICE_ERROR;
            log.warn("[ContentGeneration] Job {} thất bại ({}): {}", jobId, code, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(jobId, code, message));
        }
    }

    /** Gọi AI: stream (cờ bật — delta realtime + huỷ được giữa chừng) hoặc /generate cũ. Chạy NGOÀI transaction. */
    private GeneratedContentResult callAi(UUID jobId, GenerationTask task) {
        if (!streamingEnabled) {
            return aiServiceClient.generateContent(task.payload());
        }
        Mono<Void> cancel = cancelService.register(jobId);
        DeltaRelay relay = new DeltaRelay(task.callContext().userId(), jobId);
        try {
            // Lệnh huỷ tới TRƯỚC khi kịp đăng ký (job đã bị chốt) → không gọi AI.
            if (isCancelled(jobId)) {
                throw new AiStreamCancelledException(GeneratedContentResult.builder().tokensUsed(0L).build());
            }
            return aiServiceClient.generateContentStream(task.payload(), relay, cancel);
        } finally {
            relay.flush();
            cancelService.unregister(jobId);
        }
    }

    private boolean isCancelled(UUID jobId) {
        return jobRepository.findById(jobId).map(ContentGenerationWorkerServiceImpl::cancelledByUser).orElse(true);
    }

    static boolean cancelledByUser(ContentGenerationJob job) {
        return job.getStatus() == GenerationJobStatus.FAILED && JobEventServiceImpl.CANCELLED_BY_USER.equals(job.getErrorCode());
    }

    /**
     * Chuyển delta của luồng AI thành sự kiện SSE {@code ai.delta}, GỘP mỗi {@value #DELTA_FLUSH_MS}ms (ít lệnh Redis,
     * vẫn mượt trên UI). Gọi từ luồng I/O của WebClient — đồng bộ hoá bằng {@code synchronized}.
     */
    private final class DeltaRelay implements AiStreamListener {
        private final UUID userId;
        private final UUID jobId;
        private final Map<String, StringBuilder> pending = new LinkedHashMap<>();
        private final Set<String> replaced = new HashSet<>();
        private long seq;
        private long lastFlush = System.currentTimeMillis();

        DeltaRelay(UUID userId, UUID jobId) {
            this.userId = userId;
            this.jobId = jobId;
        }

        @Override
        public synchronized void onDelta(String path, String append, boolean replace) {
            if (path == null) return;
            if (replace) {
                pending.put(path, new StringBuilder(append));
                replaced.add(path);
            } else {
                pending.computeIfAbsent(path, k -> new StringBuilder()).append(append);
            }
            if (System.currentTimeMillis() - lastFlush >= DELTA_FLUSH_MS) {
                flush();
            }
        }

        @Override
        public synchronized void onReset(String reason) {
            pending.clear();
            replaced.clear();
            realtimeEventPublisher.toUser(userId, RealtimeEventType.AI_RESET, realtimeMapper.toAiResetEvent(jobId, reason));
        }

        synchronized void flush() {
            for (Map.Entry<String, StringBuilder> entry : pending.entrySet()) {
                realtimeEventPublisher.toUser(userId, RealtimeEventType.AI_DELTA, realtimeMapper.toAiDeltaEvent(
                        jobId, ++seq, entry.getKey(), entry.getValue().toString(),
                        replaced.contains(entry.getKey()) ? Boolean.TRUE : null));
            }
            pending.clear();
            replaced.clear();
            lastFlush = System.currentTimeMillis();
        }
    }

    private GenerationTask markRunningAndBuildPayload(UUID jobId) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentGeneration] Job {} không tồn tại khi bắt đầu xử lý", jobId);
            return null;
        }
        if (job.getStatus() != GenerationJobStatus.PENDING) {
            // Đã bị job dọn kẹt chốt FAILED trong lúc chờ hàng đợi executor — không chạy lại.
            log.warn("[ContentGeneration] Job {} không còn PENDING ({}) — bỏ qua", jobId, job.getStatus());
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);
        jobRepository.save(job);
        jobEventService.generationUpdated(jobId, STAGE_PREPARING);

        ContentStrategy strategy = job.getContentStrategy();
        BrandProfile brand = strategy.getBrandProfile();
        UUID userId = brand.getUser().getId();
        GenerateContentPayload payload = GenerateContentPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(brand))
                .strategy(aiContentMapper.toStrategyPayload(strategy))
                .platform(job.getPlatform().name())
                .trend(resolveTrend(job.getTrendId(), userId))
                .idea(resolveIdea(job.getIdeaId(), userId))
                .topic(job.getTopic())
                .note(job.getNote())
                .regenerateFrom(job.getRegenerateFrom())
                .build();
        AiUsageService.AiCallContext callContext = AiUsageService.AiCallContext.of(
                brand.getUser(), AiTaskCode.CONTENT_GENERATION, jobId, job.getClientIp(), job.getUserAgent());
        return new GenerationTask(payload, callContext);
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

    // B2: job ghi MỘT ContentVersion giàu vào bài. Khóa bài trước khi đụng version (thứ tự item → version):
    // N job song song trên cùng bài tuần tự ở bước lưu, job sau tính trạng thái tổng trên bản của job trước.
    private void saveSuccess(UUID jobId, GeneratedContentResult result) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[ContentGeneration] Job {} biến mất trước khi lưu kết quả", jobId);
            return;
        }
        if (cancelledByUser(job)) {
            // D12: user đã bấm Dừng — KHÔNG ghi đè (khác job bị đánh treo AI_TIMEOUT: kết quả về muộn vẫn được lưu).
            log.info("[ContentGeneration] Bỏ kết quả về muộn của job {} — user đã dừng", jobId);
            return;
        }
        ContentItem item = job.getContentItem() == null ? null : statusResolver.lock(job.getContentItem().getId());
        if (item != null && item.getDeletedAt() == null && !ContentItemServiceImpl.isWizardOpen(item)) {
            // Bài đã gửi duyệt / lên lịch trong lúc job chạy — không thay bản đang được dùng.
            log.warn("[ContentGeneration] Bài của job {} đã rời wizard — bỏ kết quả", jobId);
            saveFailureOn(job, "Bài đã gửi duyệt hoặc đã lên lịch trong lúc tạo — kết quả bị bỏ");
            return;
        }
        if (item == null || item.getDeletedAt() != null) {
            // Bài bị xóa trong lúc job chạy — kết quả không còn chỗ ghi.
            log.warn("[ContentGeneration] Bài của job {} không còn — bỏ kết quả", jobId);
            saveFailureOn(job, "Bài nội dung không còn tồn tại");
            return;
        }

        ContentVersion version = contentItemMapper.toGeneratedVersion(result);
        version.setContentItem(item);
        version.setPlatformName(job.getPlatform());

        // Retry / "Tạo lại": bản cũ CÙNG nền tảng bị thay bằng xóa mềm (pattern FR-46
        // của format worker) — các nền tảng khác không bị đụng.
        LocalDateTime now = LocalDateTime.now();
        contentVersionRepository
                .findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), job.getPlatform())
                .forEach(old -> old.setDeletedAt(now));
        contentVersionRepository.save(version);

        job.setResultContentVersion(version);
        job.setStatus(GenerationJobStatus.SUCCESS);
        jobRepository.save(job);
        statusResolver.refresh(item.getId());
        jobEventService.generationUpdated(jobId, null);

        // FR-77: nội dung mới do AI tạo — nhắc user xem và duyệt trước khi lên lịch.
        // (B2: mỗi nền tảng một thông báo — chấp nhận ồn nhẹ, tối ưu ở lượt sau.)
        BrandProfile brand = item.getBrandProfile();
        // Usage (event + cache hạn mức) đã được recordCall ghi tại thời điểm gọi AI.
        notificationService.send(brand.getUser(), NotificationDraft.builder()
                .type(NotificationType.REVIEW_NEEDED)
                .title("Nội dung mới cần xem xét")
                .message("AI vừa tạo nội dung mới cho thương hiệu " + brand.getBrandName()
                        + ". Hãy xem và duyệt trước khi định dạng/lên lịch đăng.")
                .refType(NotificationRefType.CONTENT_ITEM).refId(item.getId())
                .params(NotificationParams.of("brandName", brand.getBrandName(), "platform", job.getPlatform()))
                .build());
    }

    private void saveFailureOn(ContentGenerationJob job, String message) {
        job.setStatus(GenerationJobStatus.FAILED);
        job.setErrorMessage(message);
        jobRepository.save(job);
        jobEventService.generationUpdated(job.getId(), null);
    }

    private void saveFailure(UUID jobId, ErrorCode code, String message) {
        ContentGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null || cancelledByUser(job)) {
            return; // job user đã dừng giữ nguyên lý do CANCELLED_BY_USER
        }
        job.setStatus(GenerationJobStatus.FAILED);
        job.setErrorCode(code.name());
        job.setErrorMessage(message);
        jobRepository.save(job);
        jobEventService.generationFailed(jobId);
    }
}
