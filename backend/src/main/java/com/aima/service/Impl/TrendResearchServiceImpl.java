package com.aima.service.Impl;

import com.aima.service.PlanUsageService;
import com.aima.enums.PlanLimitKey;
import com.aima.dto.request.TrendDeleteRequest;
import com.aima.dto.request.TrendResearchRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.TokenUsageService;
import com.aima.service.TrendResearchService;
import com.aima.service.TrendResearchWorkerService;
import com.aima.util.RequestMeta;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class TrendResearchServiceImpl implements TrendResearchService {

    TrendResearchSessionRepository sessionRepository;
    TrendRepository trendRepository;
    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    UserRepository userRepository;
    TrendResearchMapper trendResearchMapper;
    TrendResearchWorkerService trendResearchWorkerService;
    TokenUsageService tokenUsageService;
    PlanUsageService planUsageService;

    static final String SUPERSEDED_MESSAGE = "Đã thay bằng phiên nghiên cứu bạn chủ động bắt đầu";
    static final String QUEUE_FULL_MESSAGE = "Hệ thống đang bận, vui lòng thử lại sau ít phút";

    // FR-19: "Research now" — cần brand profile đang hoạt động + chiến lược ACTIVE (BR-01, BR-03),
    // và không cho phép 2 phiên chạy song song.
    @Override
    public ApiResponse<TrendResearchSessionResponse> startResearch(String email, TrendResearchRequest request) {
        User user = currentUser(email);
        tokenUsageService.checkQuota(user); // hết hạn mức token tháng → chặn phiên mới

        BrandProfile brand = (request != null && request.getBrandProfileId() != null)
                ? brandProfileRepository.findByIdAndUser_IdAndDeletedAtIsNull(request.getBrandProfileId(), user.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.BRAND_PROFILE_NOT_FOUND))
                : brandProfileRepository.findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(user.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.ACTIVE_BRAND_PROFILE_REQUIRED));

        // Chiến lược user chọn (FR-19); không gửi → chiến lược ACTIVE mới nhất của brand.
        ContentStrategy strategy = (request != null && request.getStrategyId() != null)
                ? contentStrategyRepository.findByIdAndBrandProfile_IdAndDeletedAtIsNull(request.getStrategyId(), brand.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND))
                : contentStrategyRepository
                        .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(brand.getId(), StrategyStatus.ACTIVE)
                        .orElseThrow(() -> new AppException(ErrorCode.ACTIVE_STRATEGY_REQUIRED));
        if (strategy.getStatus() != StrategyStatus.ACTIVE) {
            throw new AppException(ErrorCode.STRATEGY_NOT_ACTIVE);
        }

        // Phiên tự động 2:00 AM còn xếp hàng (chưa chạy) không được chặn user chủ động research.
        sessionRepository.supersedeQueuedScheduled(user.getId(), LocalDateTime.now(), SUPERSEDED_MESSAGE);
        if (sessionRepository.existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(
                user.getId(), List.of(ResearchStatus.PENDING, ResearchStatus.RUNNING))) {
            throw new AppException(ErrorCode.RESEARCH_ALREADY_RUNNING);
        }

        Platform platform = (request != null && request.getPlatform() != null) ? request.getPlatform() : Platform.FACEBOOK;
        Integer articleCount = request != null ? request.getArticleCount() : null;
        // Gói: số phiên thủ công trong kỳ + trần số ý tưởng. Không gửi số → mặc định worker, kẹp về trần của gói.
        planUsageService.requireQuota(user, PlanLimitKey.TREND_RESEARCH_PER_PERIOD, null);
        if (articleCount != null) {
            planUsageService.requireCap(user, PlanLimitKey.IDEAS_PER_RESEARCH, articleCount);
        } else {
            Long ideaCap = planUsageService.cap(user, PlanLimitKey.IDEAS_PER_RESEARCH);
            if (ideaCap != null && ideaCap > 0 && ideaCap < TrendResearchWorkerServiceImpl.MAX_IDEAS) {
                articleCount = ideaCap.intValue();
            }
        }
        TrendResearchSession session = trendResearchMapper.toSession(brand, platform, strategy, articleCount,
                ResearchTrigger.MANUAL);
        session.setClientIp(RequestMeta.clientIp());
        session.setUserAgent(RequestMeta.userAgent());
        TrendResearchSession saved = sessionRepository.save(session);

        // Dispatch worker nền SAU KHI transaction commit (rule #24, cùng mẫu ContentGenerationServiceImpl).
        UUID sessionId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(sessionId);
                }
            });
        } else {
            dispatch(sessionId);
        }

        TrendResearchSessionResponse response = trendResearchMapper.toSessionResponse(saved);
        return ApiResponse.success("Đã bắt đầu nghiên cứu xu hướng", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<TrendResearchSessionResponse> getSession(String email, UUID sessionId) {
        User user = currentUser(email);
        TrendResearchSession session = sessionRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(sessionId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.RESEARCH_SESSION_NOT_FOUND));
        TrendResearchSessionResponse response = trendResearchMapper.toSessionResponse(session);
        return ApiResponse.success("Lấy phiên nghiên cứu xu hướng thành công", response);
    }

    // Xóa nhiều trend không phù hợp (multi-select ở tab "Trend nổi bật") — soft delete
    // trend + cascade idea; SQLRestriction trên collection loại chúng khỏi response/counts.
    @Override
    public ApiResponse<Integer> deleteTrends(String email, TrendDeleteRequest request) {
        User user = currentUser(email);
        List<Trend> trends = trendRepository
                .findByIdInAndResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(request.getTrendIds(), user.getId());
        if (trends.isEmpty()) {
            throw new AppException(ErrorCode.TREND_NOT_FOUND);
        }

        LocalDateTime now = LocalDateTime.now();
        for (Trend trend : trends) {
            trend.setDeletedAt(now);
            trend.getContentIdeas().forEach(idea -> idea.setDeletedAt(now));
        }
        trendRepository.saveAll(trends);

        Integer deletedCount = trends.size();
        return ApiResponse.success("Đã xóa trend không phù hợp", deletedCount);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<TrendResearchSessionSummaryResponse>> listSessions(String email) {
        User user = currentUser(email);
        List<TrendResearchSessionSummaryResponse> sessions = sessionRepository
                .findByBrandProfile_User_IdAndDeletedAtIsNullOrderByResearchTimeDesc(user.getId())
                .stream()
                .map(trendResearchMapper::toSessionSummaryResponse)
                .toList();
        return ApiResponse.success("Lấy lịch sử nghiên cứu xu hướng thành công", sessions);
    }

    // Hàng đợi đầy → executor từ chối: chốt FAILED ngay (thay vì để PENDING chặn user tới khi bị quét kẹt).
    private void dispatch(UUID sessionId) {
        try {
            trendResearchWorkerService.process(sessionId);
        } catch (TaskRejectedException e) {
            log.warn("[TrendResearch] Hàng đợi đầy, phiên {} không được nhận", sessionId);
            sessionRepository.failPending(sessionId, LocalDateTime.now(), QUEUE_FULL_MESSAGE);
        }
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
