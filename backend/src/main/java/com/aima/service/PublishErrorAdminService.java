package com.aima.service;

import com.aima.dto.request.AdminActionReasonRequest;
import com.aima.dto.request.PublishErrorMappingRequest;
import com.aima.dto.response.AdminFailedPostDetailResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.PublishErrorMappingResponse;
import com.aima.dto.response.UnclassifiedErrorGroupResponse;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Admin xử lý bài đăng lỗi (docs/failed-posts-error-handling-plan.md Phase 4): xem lỗi thô ĐÃ REDACT + timeline,
 * thử lại thay người dùng (bắt buộc lý do, ghi activity_logs), hàng đợi lỗi chưa phân loại và ánh xạ chữ ký lỗi
 * → mã AIMA có sẵn. Mọi endpoint gọi tới đây đều ADMIN.
 */
public interface PublishErrorAdminService {

    ApiResponse<AdminFailedPostDetailResponse> get(UUID postId);

    /** Thử lại thay người dùng — cùng luật chặn với "Thử lại ngay" của user. */
    ApiResponse<FailedPostRetryResponse> retry(String adminEmail, UUID postId, AdminActionReasonRequest request);

    /** Lỗi UNKNOWN trong khoảng ngày (theo giờ đăng bài VN, {@code to} bao gồm), gom theo chữ ký, đông nhất trước. */
    ApiResponse<List<UnclassifiedErrorGroupResponse>> unclassified(LocalDate from, LocalDate to);

    ApiResponse<List<PublishErrorMappingResponse>> listMappings();

    ApiResponse<PublishErrorMappingResponse> createMapping(String adminEmail, PublishErrorMappingRequest request);

    ApiResponse<PublishErrorMappingResponse> deleteMapping(String adminEmail, UUID mappingId);
}
