package com.aima.service.Impl;

import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.ai.TrendPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.ResearchStatus;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.TrendResearchWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
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
    static final int MAX_IDEAS = 10;

    TrendResearchSessionRepository sessionRepository;
    ContentStrategyRepository contentStrategyRepository;
    AiServiceClient aiServiceClient;
    TrendResearchMapper trendResearchMapper;
    AiContentMapper aiContentMapper;
    TransactionTemplate transactionTemplate;

    @Async("trendResearchExecutor")
    @Override
    public void process(UUID sessionId) {
        ResearchPayload payload = transactionTemplate.execute(status -> markRunningAndBuildPayload(sessionId));
        if (payload == null) {
            return; // phiên không tồn tại hoặc thiếu chiến lược ACTIVE (đã ghi FAILED)
        }

        try {
            ResearchResultPayload result = aiServiceClient.research(payload);
            transactionTemplate.executeWithoutResult(status -> saveSuccess(sessionId, result));
        } catch (Exception e) {
            String message = errorMessageOf(e);
            log.warn("[TrendResearch] Phiên {} thất bại: {}", sessionId, message, e);
            transactionTemplate.executeWithoutResult(status -> saveFailure(sessionId, message));
        }
    }

    private ResearchPayload markRunningAndBuildPayload(UUID sessionId) {
        TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            log.warn("[TrendResearch] Phiên {} không tồn tại khi bắt đầu xử lý", sessionId);
            return null;
        }

        BrandProfile brand = session.getBrandProfile();
        ContentStrategy strategy = contentStrategyRepository
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

        return ResearchPayload.builder()
                .brandProfile(aiContentMapper.toBrandProfilePayload(brand))
                .strategy(aiContentMapper.toStrategyPayload(strategy))
                .maxTrends(MAX_TRENDS)
                .maxIdeas(MAX_IDEAS)
                .build();
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

        session.setSummary(result.getSummary());
        session.setStatus(ResearchStatus.COMPLETED);
        sessionRepository.save(session); // cascade ALL: lưu luôn trends + content ideas
    }

    private void saveFailure(UUID sessionId, String message) {
        TrendResearchSession session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            return;
        }
        session.setStatus(ResearchStatus.FAILED);
        session.setErrorMessage(message);
        sessionRepository.save(session);
    }

    // AppException không set message qua super(...) — lấy message từ ErrorCode (cùng mẫu
    // ContentGenerationWorkerServiceImpl.errorMessageOf).
    private String errorMessageOf(Throwable e) {
        return (e instanceof AppException appException && appException.getErrorCode() != null)
                ? appException.getErrorCode().getMessage()
                : e.getMessage();
    }
}
