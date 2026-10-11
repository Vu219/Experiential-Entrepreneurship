package com.aima.service;

import com.aima.dto.request.FailedPostBulkRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostBulkResponse;
import com.aima.dto.response.FailedPostDetailResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.FailedPostSummaryResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;

import java.util.List;
import java.util.UUID;

/**
 * Trung tâm hồi phục bài lỗi của CHÍNH user (FR-35..FR-39) — khác góc nhìn admin (FR-82/83/84).
 * Mọi thao tác chỉ trên bài thuộc user (bài người khác → POST_NOT_FOUND, không lộ sự tồn tại).
 */
public interface FailedPostService {

    ApiResponse<PageResponse<FailedPostResponse>> list(String email, FailedPostFilter filter,
                                                       FailedPostStateFilter state, int page, int size);

    ApiResponse<FailedPostSummaryResponse> summary(String email);

    /** Chi tiết + timeline mọi lần thử. */
    ApiResponse<FailedPostDetailResponse> get(String email, UUID postId);

    /** "Thử lại ngay" (FR-58) — job mới chạy nền (NFR-04), trả ngay. */
    ApiResponse<FailedPostRetryResponse> retry(String email, UUID postId);

    /** Bỏ qua lỗi (ẩn khỏi "Cần xử lý"). */
    ApiResponse<FailedPostResponse> dismiss(String email, UUID postId);

    /** Thử lại / bỏ qua hàng loạt — mỗi bài một transaction, dòng lỗi không làm hỏng dòng khác. */
    ApiResponse<FailedPostBulkResponse> bulk(String email, FailedPostBulkRequest request);

    /** Nền tảng đang có sự cố diện rộng (banner trang Bài lỗi) — tự thử lại đang được hoãn. */
    ApiResponse<List<PlatformIncidentResponse>> platformStatus();
}
