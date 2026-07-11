package com.aima.service;

import com.aima.dto.request.AdjustmentDecisionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.StrategyAdjustmentResponse;
import com.aima.dto.response.StrategyOptimizationJobResponse;
import com.aima.enums.AppliedStatus;

import java.util.List;
import java.util.UUID;

/**
 * Tối ưu chiến lược từ dữ liệu (FR-65..FR-68, BR-10): job async gọi AI /analyze + /optimize,
 * lưu đề xuất PENDING làm lịch sử (FR-67); user chấp nhận/từ chối từng đề xuất (FR-68).
 */
public interface StrategyOptimizationService {

    ApiResponse<StrategyOptimizationJobResponse> start(String email, UUID strategyId);

    ApiResponse<StrategyOptimizationJobResponse> getJob(String email, UUID jobId);

    /** FR-67: lịch sử đề xuất điều chỉnh của một chiến lược (filter status optional). */
    ApiResponse<List<StrategyAdjustmentResponse>> listAdjustments(String email, UUID strategyId, AppliedStatus status);

    /** FR-68: quyết định APPLIED/REJECTED trên một đề xuất PENDING. */
    ApiResponse<StrategyAdjustmentResponse> decide(String email, UUID adjustmentId, AdjustmentDecisionRequest request);
}
