package com.aima.service;

import com.aima.dto.request.FeedbackRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FeedbackResponse;
import com.aima.dto.response.FeedbackSummaryResponse;
import com.aima.dto.response.PageResponse;

/** Kênh đánh giá & góp ý trong app (G1.3): user gửi, admin xem danh sách + tổng quan. */
public interface UserFeedbackService {

    ApiResponse<FeedbackResponse> submit(String email, FeedbackRequest request);

    ApiResponse<PageResponse<FeedbackResponse>> list(Short rating, int page, int size);

    ApiResponse<FeedbackSummaryResponse> summary();

    /**
     * DEV-ONLY (cờ {@code aima.dev.feedback-seed-enabled}, mặc định tắt; chặn khi production-mode): sinh đánh giá
     * MÔ PHỎNG rải đều 14 ngày gần nhất, gắn vào user đang có, đánh dấu {@code sample=true}. Trả số bản ghi đã tạo.
     */
    ApiResponse<Integer> devSeed(String actorEmail);

    /** DEV-ONLY: xoá mọi đánh giá mô phỏng. Trả số bản ghi đã xoá. */
    ApiResponse<Integer> devSeedClear(String actorEmail);
}
