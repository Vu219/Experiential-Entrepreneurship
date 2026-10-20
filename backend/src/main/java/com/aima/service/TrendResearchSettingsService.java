package com.aima.service;

import com.aima.dto.request.IdeaSavedRequest;
import com.aima.dto.request.TrendResearchScheduleRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.TrendResearchScheduleResponse;

import java.util.UUID;

/**
 * Thiết lập của người dùng trên trang Xu hướng (V19) — trước đây chỉ ở localStorage: lịch nghiên cứu tự động và
 * ý tưởng đã lưu.
 */
public interface TrendResearchSettingsService {

    /** Lịch hiện tại; {@code result} null = chưa cấu hình (đang chạy mặc định 02:00 hằng ngày). */
    ApiResponse<TrendResearchScheduleResponse> getSchedule(String email);

    /** Tạo / thay lịch. Bật lịch cần gói gồm AUTO_TREND_RESEARCH. */
    ApiResponse<TrendResearchScheduleResponse> saveSchedule(String email, TrendResearchScheduleRequest request);

    ApiResponse<ContentIdeaResponse> setIdeaSaved(String email, UUID ideaId, IdeaSavedRequest request);
}
