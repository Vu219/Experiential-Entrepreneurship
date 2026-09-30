package com.aima.service.Impl;

import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PublishingSettingsResponse;
import com.aima.entity.User;
import com.aima.entity.UserPublishingSettings;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PostScheduleMapper;
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PublishingSettingsService;
import com.aima.service.ScheduleHoldService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PublishingSettingsServiceImpl implements PublishingSettingsService {
    private final UserRepository users;
    private final UserPublishingSettingsRepository settings;
    private final PostScheduleMapper mapper;
    private final ScheduleHoldService holdService;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PublishingSettingsResponse> get(String email) {
        User user = currentUser(email);
        PublishingSettingsResponse response = mapper.toSettingsResponse(settingsOf(user.getId()));
        return ApiResponse.success("Lấy cài đặt đăng bài thành công", response);
    }

    @Override
    @Transactional
    public ApiResponse<PublishingSettingsResponse> update(String email, PublishingSettingsRequest request) {
        User user = currentUser(email);
        if (!ZoneId.getAvailableZoneIds().contains(request.getTimezone())) {
            throw new AppException(ErrorCode.PUBLISHING_TIMEZONE_INVALID);
        }
        if (Boolean.TRUE.equals(request.getBrandVoiceBlockingEnabled()) && request.getBrandVoiceThreshold() == null) {
            throw new AppException(ErrorCode.BRAND_VOICE_THRESHOLD_INVALID);
        }

        UserPublishingSettings current = settingsOf(user.getId());
        boolean approvalBefore = current.isRequireApproval();
        mapper.updateSettings(request, current);
        UserPublishingSettings saved = settings.save(current);
        // Bật/tắt bắt buộc duyệt áp lại cho MỌI lịch chưa đăng (không bỏ sót lịch tạo trước khi đổi).
        if (approvalBefore != saved.isRequireApproval()) {
            holdService.syncReviewHoldsForUser(user.getId());
        }
        PublishingSettingsResponse response = mapper.toSettingsResponse(saved);
        return ApiResponse.success("Đã lưu cài đặt đăng bài", response);
    }

    // User đăng ký sau Flyway V2 chưa có dòng settings → mặc định (tạo khi lưu lần đầu).
    private UserPublishingSettings settingsOf(UUID userId) {
        return settings.findById(userId).orElseGet(() -> mapper.toDefaultSettings(userId));
    }

    private User currentUser(String email) {
        return users.findByEmail(email).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
