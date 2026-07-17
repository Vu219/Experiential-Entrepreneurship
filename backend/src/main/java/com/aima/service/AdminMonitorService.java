package com.aima.service;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemActivityResponse;

/**
 * Giám sát hệ thống cho admin (FR-81..FR-83): tổng quan sức khỏe + bài thất bại/bị từ chối.
 */
public interface AdminMonitorService {

    /** FR-81: health + chỉ số thật của dependency (DB/Redis/AI service) + tài nguyên + alert lỗi mới nhất. */
    ApiResponse<AdminSystemStatusResponse> systemStatus();

    /** FR-82/FR-83: bài FAILED toàn hệ thống; violationOnly = true → chỉ bài vi phạm chính sách. */
    ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(boolean violationOnly, int page, int size);

    /** Biểu đồ hoạt động hệ thống theo khoảng: 1h | 24h | 7d | 30d | 1y (suy từ dữ liệu có timestamp). */
    ApiResponse<SystemActivityResponse> systemActivity(String range);
}
