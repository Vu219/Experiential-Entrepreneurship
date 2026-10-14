package com.aima.service.Impl;

import com.aima.service.JobEventService;
import com.aima.enums.RealtimeJobKind;
import com.aima.util.NotificationParams;
import com.aima.enums.NotificationRefType;
import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.ai.AnalyzePayload;
import com.aima.dto.ai.AnalyzeResultPayload;
import com.aima.dto.ai.AnalyzedPostPayload;
import com.aima.dto.ai.ContentStrategyInputPayload;
import com.aima.dto.ai.OptimizePayload;
import com.aima.dto.ai.OptimizeResultPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.OptimizationInsight;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.StrategyOptimizationJob;
import com.aima.enums.AiTaskCode;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.NotificationType;
import com.aima.enums.PostStatus;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.StrategyOptimizationMapper;
import com.aima.repository.OptimizationInsightRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.StrategyOptimizationJobRepository;
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.AiUsageService;
import com.aima.service.NotificationService;
import com.aima.service.StrategyOptimizationWorkerService;
import com.aima.util.PublishingTime;
import com.aima.util.UserFacingErrors;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Worker tối ưu chiến lược (FR-63..FR-66, NFR-04): transaction ngắn qua TransactionTemplate,
 * hai cuộc gọi AI (/analyze rồi /optimize) chạy NGOÀI transaction (rule #24/#28).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class StrategyOptimizationWorkerServiceImpl implements StrategyOptimizationWorkerService {

    // Đủ dữ liệu cho AI mà không phình payload — bài mới nhất trước.
    static final int MAX_POSTS = 50;
    // Thứ tự ưu tiên mốc (số liệu đầy đủ nhất trước) và số bài tối thiểu để một mốc đủ dùng.
    static final List<Integer> MILESTONE_PREFERENCE = List.of(168, 48, 24);
    static final int MIN_POSTS_PER_MILESTONE = 3;

    StrategyOptimizationJobRepository jobRepository;
    PostRepository postRepository;
    PostAnalyticsRepository postAnalyticsRepository;
    OptimizationInsightRepository insightRepository;
    AiServiceClient aiServiceClient;
    AiContentMapper aiContentMapper;
    StrategyOptimizationMapper strategyOptimizationMapper;
    NotificationService notificationService;
    AiUsageService aiUsageService;
    TransactionTemplate transactionTemplate;
    UserPublishingSettingsRepository publishingSettingsRepository;
    JobEventService jobEventService;

    @Override
    @Async("strategyOptimizationExecutor")
    public void process(UUID jobId) {
        OptimizationTask task = transactionTemplate.execute(tx -> markRunningAndBuildPayload(jobId));
        if (task == null) {
            return;
        }

        try {
            // FR-63/FR-64: success factors + insights, rồi FR-65/FR-66: đề xuất điều chỉnh.
            // Hai cuộc gọi AI → recordCall ghi HAI event usage riêng (label phân biệt idempotency).
            AnalyzeResultPayload analysis = aiUsageService.recordCall(task.callContext().withLabel("analyze"),
                    () -> aiServiceClient.analyze(task.analyzePayload()));
            // Không có insight thì đề xuất nào cũng bị bỏ (adjustment buộc có insight cha) → không gọi /optimize
            // cho khỏi tính phí vô ích; job vẫn SUCCESS với 0 đề xuất.
            OptimizeResultPayload optimization = null;
            if (analysis.getInsights() != null && !analysis.getInsights().isEmpty()) {
                OptimizePayload optimizePayload = strategyOptimizationMapper.toOptimizePayload(
                        task.analyzePayload().getBrandProfile(), task.strategyPayload(), analysis.getInsights());
                optimization = aiUsageService.recordCall(task.callContext().withLabel("optimize"),
                        () -> aiServiceClient.optimize(optimizePayload));
            } else {
                log.info("[StrategyOpt] Job {}: /analyze không trả insight nào — bỏ qua /optimize", jobId);
            }
            OptimizeResultPayload finalOptimization = optimization;

            transactionTemplate.executeWithoutResult(tx ->
                    saveSuccess(jobId, analysis, finalOptimization, task.anchorAnalyticsId()));
        } catch (Exception e) {
            log.error("[StrategyOpt] Job {} thất bại: {}", jobId, e.getMessage());
            transactionTemplate.executeWithoutResult(tx -> saveFailure(jobId, UserFacingErrors.messageOf(e)));
        }
    }

    /** Payload + ngữ cảnh event usage dựng sẵn trong transaction (dữ liệu lazy) để dùng ngoài. */
    record OptimizationTask(AnalyzePayload analyzePayload, ContentStrategyInputPayload strategyPayload,
                            UUID anchorAnalyticsId, AiUsageService.AiCallContext callContext) {
    }

    private OptimizationTask markRunningAndBuildPayload(UUID jobId) {
        StrategyOptimizationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.warn("[StrategyOpt] Job {} không tồn tại — bỏ qua", jobId);
            return null;
        }
        job.setStatus(GenerationJobStatus.RUNNING);

        ContentStrategy strategy = job.getContentStrategy();
        BrandProfile brand = strategy.getBrandProfile();
        emit(job);

        List<Post> posts = postRepository
                .findBySchedule_ContentVersion_ContentItem_BrandProfile_IdAndStatusAndDeletedAtIsNullOrderByPublishedAtDesc(
                        brand.getId(), PostStatus.POSTED);

        // Mọi bài gửi AI phải cùng MỘT mốc — số 7 ngày của bài cũ đặt cạnh số 24h của bài mới sẽ làm AI kết luận sai.
        Integer milestone = chooseMilestone(posts);
        ZoneId zone = publishingZone(brand.getUser().getId());

        List<AnalyzedPostPayload> postPayloads = new ArrayList<>();
        UUID anchorAnalyticsId = null;
        for (Post post : posts) {
            if (postPayloads.size() >= MAX_POSTS || milestone == null) {
                break;
            }
            PostAnalytics snapshot = milestoneOf(post, milestone);
            if (snapshot == null) {
                continue; // bài chưa tới mốc đã chọn → bỏ, không trộn mốc khác
            }
            postPayloads.add(strategyOptimizationMapper.toAnalyzedPostPayload(
                    post, post.getSchedule().getContentVersion(), snapshot, zone));
            if (anchorAnalyticsId == null) {
                anchorAnalyticsId = snapshot.getId();
            }
        }

        if (postPayloads.isEmpty()) {
            // Race hiếm: guard ở service qua nhưng analytics bị xóa trước khi worker chạy.
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage("Không còn bài đăng nào có số liệu để phân tích");
            emit(job);
            return null;
        }

        AnalyzePayload analyzePayload = strategyOptimizationMapper.toAnalyzePayload(
                aiContentMapper.toBrandProfilePayload(brand), postPayloads);
        AiUsageService.AiCallContext callContext = AiUsageService.AiCallContext.of(
                brand.getUser(), AiTaskCode.STRATEGY_OPTIMIZATION, jobId, job.getClientIp(), job.getUserAgent());
        return new OptimizationTask(analyzePayload, aiContentMapper.toStrategyPayload(strategy),
                anchorAnalyticsId, callContext);
    }

    /**
     * Mốc dùng chung cho cả lượt phân tích: mốc DÀI nhất (168h → 48h → 24h) có ít nhất {@value #MIN_POSTS_PER_MILESTONE}
     * bài; không mốc nào đủ thì lấy mốc có nhiều bài nhất (hoà → mốc dài hơn). null = không bài nào có số liệu.
     */
    static Integer chooseMilestone(List<Post> posts) {
        Integer best = null;
        long bestCount = 0;
        for (int milestone : MILESTONE_PREFERENCE) {
            long count = posts.stream().filter(p -> milestoneOf(p, milestone) != null).count();
            if (count >= MIN_POSTS_PER_MILESTONE) {
                return milestone;
            }
            if (count > bestCount) {
                best = milestone;
                bestCount = count;
            }
        }
        return best;
    }

    private static PostAnalytics milestoneOf(Post post, int milestone) {
        return post.getPostAnalytics().stream()
                .filter(a -> a.getDeletedAt() == null && Objects.equals(a.getMilestoneHours(), milestone))
                .findFirst()
                .orElse(null);
    }

    // Giờ đăng gửi AI tính theo múi giờ đăng bài của user (cài đặt đăng bài), mặc định giờ VN như cũ.
    private ZoneId publishingZone(UUID userId) {
        return publishingSettingsRepository.findById(userId)
                .map(settings -> ZoneId.of(settings.getTimezone()))
                .orElse(PublishingTime.LEGACY_ZONE);
    }

    private void saveSuccess(UUID jobId, AnalyzeResultPayload analysis, OptimizeResultPayload optimization,
                             UUID anchorAnalyticsId) {
        StrategyOptimizationJob job = jobRepository.findById(jobId).orElseThrow();
        ContentStrategy strategy = job.getContentStrategy();
        PostAnalytics anchor = postAnalyticsRepository.findById(anchorAnalyticsId).orElseThrow();

        // Insight là kết luận TỔNG HỢP trên nhiều bài; schema (DATA_MODEL) buộc mỗi insight gắn một
        // bản ghi analytics → neo vào snapshot mới nhất đã đưa vào phân tích.
        List<OptimizationInsight> insights = new ArrayList<>();
        if (analysis.getInsights() != null) {
            analysis.getInsights().forEach(payload ->
                    insights.add(strategyOptimizationMapper.toInsight(payload, anchor)));
        }

        // StrategyAdjustment buộc có insight cha (cascade từ insight) — các đề xuất đều rút từ cùng
        // bộ insight nên gắn chung insight đầu tiên; không có insight thì chỉ lưu future improvements.
        if (!insights.isEmpty() && optimization != null && optimization.getStrategyAdjustments() != null) {
            OptimizationInsight parent = insights.get(0);
            optimization.getStrategyAdjustments().forEach(payload -> parent.getStrategyAdjustments()
                    .add(strategyOptimizationMapper.toAdjustment(payload, strategy, parent)));
        }
        insightRepository.saveAll(insights);

        List<String> improvements = optimization == null || optimization.getFutureImprovements() == null
                ? List.of() : optimization.getFutureImprovements();
        job.setFutureImprovements(improvements.isEmpty() ? null : String.join("\n", improvements));
        job.setStatus(GenerationJobStatus.SUCCESS);
        emit(job);

        int adjustmentCount = insights.isEmpty() ? 0
                : insights.get(0).getStrategyAdjustments().size();
        log.info("[StrategyOpt] Job {} xong: {} insight, {} đề xuất, {} cải tiến",
                jobId, insights.size(), adjustmentCount, improvements.size());

        // Usage (event /analyze, + /optimize nếu có gọi, và cache hạn mức) đã được recordCall ghi
        // tại thời điểm gọi AI.

        if (insights.isEmpty()) {
            return; // không có insight/đề xuất mới → không báo NEW_INSIGHT sai sự thật
        }
        // FR-79: báo có insight/đề xuất mới cho user.
        notificationService.send(strategy.getBrandProfile().getUser(), NotificationDraft.builder()
                .type(NotificationType.NEW_INSIGHT)
                .title("Có đề xuất tối ưu chiến lược mới")
                .message("AI vừa phân tích hiệu quả các bài đã đăng và đưa ra " + adjustmentCount
                        + " đề xuất điều chỉnh cho chiến lược \"" + strategy.getName()
                        + "\". Vào phần Chiến lược để xem và duyệt.")
                .refType(NotificationRefType.STRATEGY).refId(strategy.getId())
                .params(NotificationParams.of("strategyName", strategy.getName(), "count", adjustmentCount))
                .build());
    }

    private void saveFailure(UUID jobId, String message) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage(message);
            emit(job);
        });
    }

    /** {@code job.updated} cho màn chờ tối ưu chiến lược (gọi trong transaction). */
    private void emit(StrategyOptimizationJob job) {
        jobEventService.jobUpdated(job.getContentStrategy().getBrandProfile().getUser().getId(), RealtimeJobKind.OPTIMIZE,
                job.getId(), job.getStatus().name(), null, null, null);
    }
}
