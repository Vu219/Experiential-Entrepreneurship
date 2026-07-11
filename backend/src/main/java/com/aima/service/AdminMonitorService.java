package com.aima.service;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;

/**
 * Giám sát hệ thống cho admin (FR-81..FR-83): tổng quan sức khỏe + bài thất bại/bị từ chối.
 */
public interface AdminMonitorService {

    /** FR-81: health các dependency (DB/Redis/AI service) + số liệu vận hành + alert lỗi mới nhất. */
    ApiResponse<AdminSystemStatusResponse> systemStatus();

    /** FR-82/FR-83: bài FAILED toàn hệ thống; violationOnly = true → chỉ bài vi phạm chính sách. */
    ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(boolean violationOnly, int page, int size);
}
