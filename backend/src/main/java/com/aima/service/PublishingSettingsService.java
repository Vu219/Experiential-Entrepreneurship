package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.response.PublishingSettingsResponse;

public interface PublishingSettingsService {
    ApiResponse<PublishingSettingsResponse> get(String email);

    /** Lưu policy đăng bài; đổi bắt buộc duyệt đồng bộ lại lý do tạm giữ của mọi lịch chưa đăng. */
    ApiResponse<PublishingSettingsResponse> update(String email, PublishingSettingsRequest request);
}
