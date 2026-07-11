package com.aima.service.Impl;

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
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.NotificationType;
import com.aima.enums.PostStatus;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.StrategyOptimizationMapper;
import com.aima.repository.OptimizationInsightRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.StrategyOptimizationJobRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.NotificationService;
import com.aima.service.StrategyOptimizationWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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

    StrategyOptimizationJobRepository jobRepository;
    PostRepository postRepository;
    PostAnalyticsRepository postAnalyticsRepository;
    OptimizationInsightRepository insightRepository;
    AiServiceClient aiServiceClient;
    AiContentMapper aiContentMapper;
    StrategyOptimizationMapper strategyOptimizationMapper;
    NotificationService notificationService;
    TransactionTemplate transactionTemplate;

    @Override
    @Async("strategyOptimizationExecutor")
    public void process(UUID jobId) {
        OptimizationTask task = transactionTemplate.execute(tx -> markRunningAndBuildPayload(jobId));
        if (task == null) {
            return;
        }

        try {
            // FR-63/FR-64: success factors + insights, rồi FR-65/FR-66: đề xuất điều chỉnh.
            AnalyzeResultPayload analysis = aiServiceClient.analyze(task.analyzePayload());
            OptimizePayload optimizePayload = strategyOptimizationMapper.toOptimizePayload(
                    task.analyzePayload().getBrandProfile(), task.strategyPayload(), analysis.getInsights());
            OptimizeResultPayload optimization = aiServiceClient.optimize(optimizePayload);

            transactionTemplate.executeWithoutResult(tx ->
                    saveSuccess(jobId, analysis, optimization, task.anchorAnalyticsId()));
        } catch (Exception e) {
            log.error("[StrategyOpt] Job {} thất bại: {}", jobId, e.getMessage());
            transactionTemplate.executeWithoutResult(tx -> saveFailure(jobId, e.getMessage()));
        }
    }

    /** Payload dựng sẵn trong transaction (dữ liệu lazy) để dùng ngoài transaction. */
    record OptimizationTask(AnalyzePayload analyzePayload, ContentStrategyInputPayload strategyPayload,
                            UUID anchorAnalyticsId) {
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

        List<Post> posts = postRepository
                .findBySchedule_ContentVersion_ContentItem_BrandProfile_IdAndStatusAndDeletedAtIsNullOrderByPublishedAtDesc(
                        brand.getId(), PostStatus.POSTED);

        List<AnalyzedPostPayload> postPayloads = new ArrayList<>();
        UUID anchorAnalyticsId = null;
        for (Post post : posts) {
            if (postPayloads.size() >= MAX_POSTS) {
                break;
            }
            // Snapshot mốc MUỘN nhất của bài = số liệu đầy đủ nhất.
            PostAnalytics latest = post.getPostAnalytics().stream()
                    .filter(a -> a.getDeletedAt() == null)
                    .max(Comparator.comparing(PostAnalytics::getMilestoneHours))
                    .orElse(null);
            if (latest == null) {
                continue;
            }
            postPayloads.add(strategyOptimizationMapper.toAnalyzedPostPayload(
                    post, post.getSchedule().getContentVersion(), latest));
            if (anchorAnalyticsId == null) {
                anchorAnalyticsId = latest.getId();
            }
        }

        if (postPayloads.isEmpty()) {
            // Race hiếm: guard ở service qua nhưng analytics bị xóa trước khi worker chạy.
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage("Không còn bài đăng nào có số liệu để phân tích");
            return null;
        }

        AnalyzePayload analyzePayload = strategyOptimizationMapper.toAnalyzePayload(
                aiContentMapper.toBrandProfilePayload(brand), postPayloads);
        return new OptimizationTask(analyzePayload, aiContentMapper.toStrategyPayload(strategy), anchorAnalyticsId);
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
        if (!insights.isEmpty() && optimization.getStrategyAdjustments() != null) {
            OptimizationInsight parent = insights.get(0);
            optimization.getStrategyAdjustments().forEach(payload -> parent.getStrategyAdjustments()
                    .add(strategyOptimizationMapper.toAdjustment(payload, strategy, parent)));
        }
        insightRepository.saveAll(insights);

        List<String> improvements = optimization.getFutureImprovements() == null
                ? List.of() : optimization.getFutureImprovements();
        job.setFutureImprovements(improvements.isEmpty() ? null : String.join("\n", improvements));
        job.setStatus(GenerationJobStatus.SUCCESS);

        int adjustmentCount = insights.isEmpty() ? 0
                : insights.get(0).getStrategyAdjustments().size();
        log.info("[StrategyOpt] Job {} xong: {} insight, {} đề xuất, {} cải tiến",
                jobId, insights.size(), adjustmentCount, improvements.size());

        // FR-79: báo có insight/đề xuất mới cho user.
        notificationService.notify(strategy.getBrandProfile().getUser(), NotificationType.NEW_INSIGHT,
                "Có đề xuất tối ưu chiến lược mới",
                "AI vừa phân tích hiệu quả các bài đã đăng và đưa ra " + adjustmentCount
                        + " đề xuất điều chỉnh cho chiến lược \"" + strategy.getName()
                        + "\". Vào phần Chiến lược để xem và duyệt.",
                strategy.getId());
    }

    private void saveFailure(UUID jobId, String message) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(GenerationJobStatus.FAILED);
            job.setErrorMessage(message);
        });
    }
}
