package com.aima.service;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentGenerationJobResponse;

import java.util.UUID;

public interface ContentGenerationService {

    ApiResponse<ContentGenerationJobResponse> startGeneration(String email, ContentGenerationRequest request, String idempotencyKey);

    ApiResponse<ContentGenerationJobResponse> getJob(String email, UUID jobId);

    /**
     * Nút Dừng (D12): job PENDING/RUNNING của chính user → FAILED + {@code errorCode=CANCELLED_BY_USER} (không thêm trạng
     * thái mới), giải phóng ngay slot "tối đa 3 job", phát lệnh huỷ tới mọi instance (luồng AI đang stream bị đóng →
     * provider ngừng sinh). Job đã xong → trả nguyên trạng (idempotent).
     */
    ApiResponse<ContentGenerationJobResponse> cancel(String email, UUID jobId);
}
