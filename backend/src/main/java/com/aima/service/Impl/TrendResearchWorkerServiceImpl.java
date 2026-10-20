package com.aima.service.Impl;

import com.aima.enums.RealtimeJobKind;
import com.aima.service.JobEventService;
import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.PreviousTrendPayload;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.ai.TrendPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.AiTaskCode;
import com.aima.enums.ResearchStatus;
import com.aima.enums.StrategyStatus;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.AiUsageService;
import com.aima.service.TrendResearchWorkerService;
import com.aima.util.UserFacingErrors;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Xử lý nền cho {@link TrendResearchSession} (NFR-04, FR-19..FR-23) — cùng mẫu
 * {@link ContentGenerationWorkerServiceImpl}: trạng thái RUNNING commit ngay qua transaction ngắn,
 * cuộc gọi AI chạy NGOÀI transaction, kết quả/lỗi được lưu trong transaction ngắn thứ hai.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class TrendResearchWorkerServiceImpl implements TrendResearchWorkerService {

    static final int MAX_TRENDS = 8;
    public static final int MAX_IDEAS = 10;
    // Trend các phiên trước gửi kèm AI (momentum, tránh lặp): trong 30 ngày, tối đa 40 tên.
    static final int PREVIOUS_TRENDS_DAYS = 30;
    static final int PREVIOUS_TRENDS_LIMIT = 40;

    TrendResearchSessionRepository sessionRepository;
    TrendRepository trendRepository;
    ContentStrategyRepository contentStrategyRepository;
    AiServiceClient aiServiceClient;
    TrendResearchMapper trendResearchMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;
    AiUsageService aiUsageService;
    JobEventService jobEventService;

    /** Payload + ngữ cảnh event usage, dựng trong TX ngắn #1 để dùng ngoài transaction. */
    private record ResearchTask(ResearchPayload payload, AiUsageService.AiCallContext callContext) {
    }

    @Async("trendResearchExecutor")
    @Override
    public void process(UUID sessionId) {
        run(sessionId);
    }

    @Async("scheduledTrendResearchExecutor")
    @Override
    public void processScheduled(UUID sessionId) {
        run(sessionId);
    }

    private void run(UUID sessionId) {
        ResearchTask task = transactionTemplate.execute(status -> markRunningAndBuildPayload(sessionId));
        if (task == null) {
            return; // phiên không tồn tại hoặc thiếu chiến lược ACTIVE (đã ghi FAILED)
        }

        try {
            // Gọi AI NGOÀI transaction (rule #24), bọc recordCall để ghi event usage (kể cả lỗi).
            ResearchResultPayload result = aiUsageService.recordCall(task.callContext(),
                    () -> aiServiceClient.research(task.payload()));
            transactionTemplate.executeWithoutResult(status -> saveSuccess(sessionId, result));
        } catch (Exception e) {
            // AppException giờ truyền message của ErrorCode vào super(...) nên getMessage() luôn có nghĩa.
            String message = UserFacingErrors.messageOf(e); // chuỗi kỹ thuật không lộ ra người dùng — e vẫn được log đủ
            log.warn("[TrendResearch] Phiên {} thất bại: {}", sessionId, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(sessionId, message));
        }
    }

    private ResearchTask markRunningAndBuildPayload(UUID sessionId) {
        TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            log.warn("[TrendResearch] Phiên {} không tồn tại khi bắt đầu xử lý", sessionId);
            return null;
        }
        if (session.getStatus() != ResearchStatus.PENDING) {
            // Đã bị chốt FAILED (kẹt quá lâu / bị phiên thủ công thay thế) trước khi tới lượt — bỏ qua.
            log.info("[TrendResearch] Phiên {} không còn PENDING ({}), bỏ qua", sessionId, session.getStatus());
            return null;
        }

        BrandProfile brand = session.getBrandProfile();
        // Ưu tiên chiến lược user chọn lúc tạo phiên (nếu còn ACTIVE); không có → ACTIVE mới nhất.
        ContentStrategy strategy = session.getContentStrategy() != null
                && session.getContentStrategy().getStatus() == StrategyStatus.ACTIVE
                && session.getContentStrategy().getDeletedAt() == null
                ? session.getContentStrategy()
                : contentStrategyRepository
                        .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                                brand.getId(), StrategyStatus.ACTIVE)
                        .orElse(null);
        if (strategy == null) {
            // Chiến lược bị đổi trạng thái giữa lúc tạo phiên và lúc worker chạy.
            session.setStatus(ResearchStatus.FAILED);
            session.setErrorMessage("Chiến lược nội dung ACTIVE không còn tồn tại");
            sessionRepository.save(session);
            return null;
        }

        session.setStatus(ResearchStatus.RUNNING);
        sessionRepository.save(session);
        jobEventService.jobUpdated(brand.getUser().getId(), RealtimeJobKind.TREND, session.getId(),
                ResearchStatus.RUNNING.name(), null, session.getPlatform(), null);

        // Số ý tưởng user yêu cầu (1-20, đã validate ở request); null = mặc định MAX_IDEAS.
        int maxIdeas = session.getArticleCount() != null
                ? Math.max(1, Math.min(20, session.getArticleCount()))
                : MAX_IDEAS;
        ResearchPayload payload = ResearchPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(brand))
                .strategy(aiContentMapper.toStrategyPayload(strategy))
                .platform(session.getPlatform().name()) // nền tảng đích (AI chuẩn hoá case)
                .previousTrends(previousTrends(brand, session))
                .maxTrends(MAX_TRENDS)
                .maxIdeas(maxIdeas)
                .build();
        AiUsageService.AiCallContext callContext = AiUsageService.AiCallContext.of(
                brand.getUser(), AiTaskCode.TREND_RESEARCH, sessionId,
                session.getClientIp(), session.getUserAgent());
        return new ResearchTask(payload, callContext);
    }

    /** Trend đã gợi ý ở các phiên gần đây (cùng brand + nền tảng), mỗi tên một lần — bản mới nhất. */
    private List<PreviousTrendPayload> previousTrends(BrandProfile brand, TrendResearchSession session) {
        Map<String, PreviousTrendPayload> byName = new LinkedHashMap<>();
        trendRepository.findRecentForBrand(brand.getId(), session.getPlatform(),
                        LocalDateTime.now().minusDays(PREVIOUS_TRENDS_DAYS), PageRequest.of(0, PREVIOUS_TRENDS_LIMIT))
                .forEach(view -> byName.putIfAbsent(view.getTrendName().trim().toLowerCase(Locale.ROOT),
                        trendResearchMapper.toPreviousTrendPayload(view)));
        return new ArrayList<>(byName.values());
    }

    private void saveSuccess(UUID sessionId, ResearchResultPayload result) {
        TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            log.warn("[TrendResearch] Phiên {} biến mất trước khi lưu kết quả", sessionId);
            return;
        }

        Map<String, Trend> trendsByName = new HashMap<>();
        if (result.getTrends() != null) {
            for (TrendPayload payload : result.getTrends()) {
                Trend trend = trendResearchMapper.toTrend(payload);
                trend.setResearchSession(session);
                session.getTrends().add(trend);
                if (payload.getTrendName() != null) {
                    trendsByName.put(payload.getTrendName().trim().toLowerCase(Locale.ROOT), trend);
                }
            }
        }

        // Gắn ý tưởng vào trend qua trend_name; không khớp được thì gắn vào trend đầu tiên
        // (ContentIdea bắt buộc có trend cha — xem entity).
        if (result.getContentIdeas() != null && !session.getTrends().isEmpty()) {
            Trend fallback = session.getTrends().get(0);
            for (ContentIdeaPayload payload : result.getContentIdeas()) {
                ContentIdea idea = trendResearchMapper.toContentIdea(payload);
                Trend parent = payload.getTrendName() == null ? fallback
                        : trendsByName.getOrDefault(payload.getTrendName().trim().toLowerCase(Locale.ROOT), fallback);
                idea.setTrend(parent);
                parent.getContentIdeas().add(idea);
            }
        }

        trendResearchMapper.applyResult(result, session); // summary + grounded + nguồn dữ liệu đã dùng
        session.setStatus(ResearchStatus.COMPLETED);
        session.setErrorMessage(null);
        sessionRepository.save(session); // cascade ALL: lưu luôn trends + content ideas
        jobEventService.researchFinished(sessionId);

        // Usage (event + cache hạn mức) đã được recordCall ghi tại thời điểm gọi AI.
    }

    private void saveFailure(UUID sessionId, String message) {
        TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            return;
        }
        session.setStatus(ResearchStatus.FAILED);
        session.setErrorMessage(message);
        sessionRepository.save(session);
        jobEventService.researchFinished(sessionId);
    }
}
