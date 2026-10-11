package com.aima.service;

import com.aima.dto.request.AiFixApplyRequest;
import com.aima.dto.request.AiFixStartRequest;
import com.aima.dto.request.PolicyCheckRequest;
import com.aima.dto.response.AiAssistJobResponse;
import com.aima.dto.response.AiAssistUsageResponse;
import com.aima.dto.response.AiFixApplyResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PolicyCheckResponse;

import java.util.UUID;

/**
 * AI hỗ trợ chính sách (failed-posts đợt 2 — docs/failed-posts-error-handling-plan.md §8). Mọi lời gọi AI chạy
 * nền (NFR-04) qua {@link AiAssistWorkerService}; token tính vào "Token AI tháng này" (AiUsageService).
 */
public interface AiAssistService {

    /** POST /me/ai-assist/fixes — CHỈ khi người dùng bấm "AI sửa nội dung"; trả job PENDING để FE poll. */
    ApiResponse<AiAssistJobResponse> startFix(String email, AiFixStartRequest request);

    /** GET /me/ai-assist/jobs/{id} — trạng thái + kết quả (gợi ý sửa / đánh giá rủi ro). */
    ApiResponse<AiAssistJobResponse> getJob(String email, UUID jobId);

    /**
     * POST /me/ai-assist/fixes/{id}/apply — lưu nội dung người dùng đã duyệt (qua đúng luồng sửa tay) rồi, khi
     * {@code RETRY_NOW}, thử lại bài lỗi. Không chạy trong một transaction bao ngoài: hai bước là hai giao dịch.
     */
    ApiResponse<AiFixApplyResponse> applyFix(String email, UUID jobId, AiFixApplyRequest request);

    /** GET /me/ai-assist/usage — lượt AI kiểm tra đã dùng / tổng và số lần AI sửa mỗi bản, theo gói của user. */
    ApiResponse<AiAssistUsageResponse> getUsage(String email);

    /** POST /me/ai-assist/policy-check — tầng luật đồng bộ; tầng AI (nếu cần + được phép) chạy nền, cache theo hash. */
    ApiResponse<PolicyCheckResponse> checkPolicy(String email, PolicyCheckRequest request);
}
