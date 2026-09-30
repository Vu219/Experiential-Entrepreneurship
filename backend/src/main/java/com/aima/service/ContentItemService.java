package com.aima.service;

import com.aima.dto.request.ContentItemCreateRequest;
import com.aima.dto.request.ContentItemReviewRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.ContentWizardStateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.Platform;
import com.aima.enums.ReviewStatus;

import java.time.LocalDate;
import java.util.UUID;

public interface ContentItemService {

    ApiResponse<PageResponse<ContentItemResponse>> list(String email, ContentItemStatus status,
                                                        ReviewStatus reviewStatus, UUID brandProfileId,
                                                        Platform platform, String industry, LocalDate fromDate,
                                                        LocalDate toDate, String q, String sort, int page, int size);

    /** B2: tạo bài (shell DRAFT) để các job generate ghi ContentVersion theo nền tảng vào. */
    ApiResponse<ContentItemResponse> create(String email, ContentItemCreateRequest request);

    ApiResponse<ContentItemResponse> getItem(String email, UUID itemId);

    ApiResponse<ContentItemResponse> updateItem(String email, UUID itemId, ContentItemUpdateRequest request);

    /** B2/FR-33: sửa thủ công MỘT bản nền tảng trong bài (partial update). */
    ApiResponse<ContentItemResponse> updateVersion(String email, UUID itemId, UUID versionId,
                                                   ContentVersionUpdateRequest request);

    /** FR-34: đổi trạng thái duyệt; gửi lại đúng trạng thái hiện tại là no-op. */
    ApiResponse<ContentItemResponse> updateReview(String email, UUID itemId, ContentItemReviewRequest request);

    /** Auto-save trạng thái wizard trên bài chưa gửi duyệt/lên lịch — để "Tiếp tục" đúng bước đang dở. */
    ApiResponse<ContentItemResponse> updateWizardState(String email, UUID itemId, ContentWizardStateRequest request);

    ApiResponse<ContentItemResponse> delete(String email, UUID itemId);
}
