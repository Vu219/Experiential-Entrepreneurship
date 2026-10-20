package com.aima.service.Impl;

import com.aima.dto.request.IdeaSavedRequest;
import com.aima.dto.request.TrendResearchScheduleRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.TrendResearchScheduleResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.TrendResearchSchedule;
import com.aima.entity.User;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.TrendScheduleFrequency;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentIdeaRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendResearchScheduleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PlanUsageService;
import com.aima.service.TrendResearchSettingsService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class TrendResearchSettingsServiceImpl implements TrendResearchSettingsService {

    TrendResearchScheduleRepository scheduleRepository;
    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    ContentIdeaRepository contentIdeaRepository;
    UserRepository userRepository;
    TrendResearchMapper trendResearchMapper;
    PlanUsageService planUsageService;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<TrendResearchScheduleResponse> getSchedule(String email) {
        User user = currentUser(email);
        TrendResearchScheduleResponse response = scheduleRepository.findByUser_IdAndDeletedAtIsNull(user.getId())
                .map(trendResearchMapper::toScheduleResponse)
                .orElse(null);
        return ApiResponse.success("Lịch nghiên cứu tự động", response);
    }

    @Override
    public ApiResponse<TrendResearchScheduleResponse> saveSchedule(String email, TrendResearchScheduleRequest request) {
        User user = currentUser(email);
        if (request.getFrequency() == TrendScheduleFrequency.WEEKLY
                && (request.getDays() == null || request.getDays().isEmpty())) {
            throw new AppException(ErrorCode.TREND_SCHEDULE_INVALID);
        }
        if (Boolean.TRUE.equals(request.getEnabled())) {
            planUsageService.requireIncluded(user, PlanLimitKey.AUTO_TREND_RESEARCH);
        }
        BrandProfile brand = request.getBrandProfileId() == null ? null
                : brandProfileRepository.findByIdAndUser_IdAndDeletedAtIsNull(request.getBrandProfileId(), user.getId())
                        .orElseThrow(() -> new AppException(ErrorCode.BRAND_PROFILE_NOT_FOUND));
        ContentStrategy strategy = null;
        if (request.getStrategyId() != null) {
            if (brand == null) {
                throw new AppException(ErrorCode.TREND_SCHEDULE_INVALID); // chiến lược phải đi cùng hồ sơ của nó
            }
            strategy = contentStrategyRepository.findByIdAndBrandProfile_IdAndDeletedAtIsNull(request.getStrategyId(), brand.getId())
                    .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND));
        }

        TrendResearchSchedule schedule = scheduleRepository.findByUser_IdAndDeletedAtIsNull(user.getId())
                .orElseGet(TrendResearchSchedule::new);
        trendResearchMapper.updateSchedule(request, schedule);
        if (request.getFrequency() == TrendScheduleFrequency.DAILY) {
            schedule.setDays(null);
        }
        schedule.setUser(user);
        schedule.setBrandProfile(brand);
        schedule.setContentStrategy(strategy);
        TrendResearchSchedule saved = scheduleRepository.save(schedule);
        log.info("[TrendSchedule] User {} lưu lịch nghiên cứu tự động: bật={}, {} lúc {}", user.getId(),
                saved.getEnabled(), saved.getFrequency(), saved.getRunTime());

        TrendResearchScheduleResponse response = trendResearchMapper.toScheduleResponse(saved);
        return ApiResponse.success("Đã lưu lịch nghiên cứu tự động", response);
    }

    @Override
    public ApiResponse<ContentIdeaResponse> setIdeaSaved(String email, UUID ideaId, IdeaSavedRequest request) {
        User user = currentUser(email);
        ContentIdea idea = contentIdeaRepository.findByIdAndTrend_ResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(
                        ideaId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_IDEA_NOT_FOUND));
        boolean save = Boolean.TRUE.equals(request.getSaved());
        // Lưu lại ý tưởng đã lưu giữ nguyên mốc cũ (thứ tự "đã lưu" không nhảy).
        if (save && idea.getSavedAt() == null) {
            idea.setSavedAt(LocalDateTime.now());
        } else if (!save) {
            idea.setSavedAt(null);
        }
        ContentIdea saved = contentIdeaRepository.save(idea);
        ContentIdeaResponse response = trendResearchMapper.toContentIdeaResponse(saved);
        return ApiResponse.success(save ? "Đã lưu ý tưởng" : "Đã bỏ lưu ý tưởng", response);
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
