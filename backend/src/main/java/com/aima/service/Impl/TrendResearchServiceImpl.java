package com.aima.service.Impl;

import com.aima.dto.request.TrendResearchRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.TrendResearchService;
import com.aima.service.TrendResearchWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class TrendResearchServiceImpl implements TrendResearchService {

    TrendResearchSessionRepository sessionRepository;
    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    UserRepository userRepository;
    TrendResearchMapper trendResearchMapper;
    TrendResearchWorkerService trendResearchWorkerService;

    // FR-19: "Research now" — cần brand profile đang hoạt động + chiến lược ACTIVE (BR-01, BR-03),
    // và không cho phép 2 phiên chạy song song.
    @Override
    public ApiResponse<TrendResearchSessionResponse> startResearch(String email, TrendResearchRequest request) {
        User user = currentUser(email);

        BrandProfile brand = (request != null && request.getBrandProfileId() != null)
                ? brandProfileRepository.findByIdAndUser_IdAndDeletedAtIsNull(request.getBrandProfileId(), user.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.BRAND_PROFILE_NOT_FOUND))
                : brandProfileRepository.findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(user.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.ACTIVE_BRAND_PROFILE_REQUIRED));

        contentStrategyRepository
                .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(brand.getId(), StrategyStatus.ACTIVE)
                .orElseThrow(() -> new AppException(ErrorCode.ACTIVE_STRATEGY_REQUIRED));

        if (sessionRepository.existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(
                user.getId(), List.of(ResearchStatus.PENDING, ResearchStatus.RUNNING))) {
            throw new AppException(ErrorCode.RESEARCH_ALREADY_RUNNING);
        }

        Platform platform = (request != null && request.getPlatform() != null) ? request.getPlatform() : Platform.FACEBOOK;
        TrendResearchSession session = trendResearchMapper.toSession(brand, platform);
        TrendResearchSession saved = sessionRepository.save(session);

        // Dispatch worker nền SAU KHI transaction commit (rule #24, cùng mẫu ContentGenerationServiceImpl).
        UUID sessionId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    trendResearchWorkerService.process(sessionId);
                }
            });
        } else {
            trendResearchWorkerService.process(sessionId);
        }

        return ApiResponse.success("Đã bắt đầu nghiên cứu xu hướng",
                trendResearchMapper.toSessionResponse(saved));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<TrendResearchSessionResponse> getSession(String email, UUID sessionId) {
        User user = currentUser(email);
        TrendResearchSession session = sessionRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(sessionId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.RESEARCH_SESSION_NOT_FOUND));
        return ApiResponse.success("Lấy phiên nghiên cứu xu hướng thành công",
                trendResearchMapper.toSessionResponse(session));
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

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
