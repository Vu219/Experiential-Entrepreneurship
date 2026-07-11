package com.aima.service.Impl;

import com.aima.dto.request.AdjustmentDecisionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.StrategyAdjustmentResponse;
import com.aima.dto.response.StrategyOptimizationJobResponse;
import com.aima.entity.ContentStrategy;
import com.aima.entity.StrategyAdjustment;
import com.aima.entity.StrategyOptimizationJob;
import com.aima.entity.User;
import com.aima.enums.AppliedStatus;
import com.aima.enums.PostStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.StrategyOptimizationMapper;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.StrategyAdjustmentRepository;
import com.aima.repository.StrategyOptimizationJobRepository;
import com.aima.repository.UserRepository;
import com.aima.service.StrategyOptimizationService;
import com.aima.service.StrategyOptimizationWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * FR-65..FR-68 (BR-10): khởi động job tối ưu chiến lược, đọc lịch sử đề xuất và ghi nhận
 * quyết định của user. Đề xuất là văn bản gợi ý — APPLIED nghĩa là user đồng ý và tự cập nhật
 * chiến lược theo gợi ý (không auto-sửa field chiến lược).
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class StrategyOptimizationServiceImpl implements StrategyOptimizationService {

    StrategyOptimizationJobRepository jobRepository;
    StrategyAdjustmentRepository adjustmentRepository;
    ContentStrategyRepository contentStrategyRepository;
    PostRepository postRepository;
    UserRepository userRepository;
    StrategyOptimizationMapper strategyOptimizationMapper;
    StrategyOptimizationWorkerService workerService;

    @Override
    public ApiResponse<StrategyOptimizationJobResponse> start(String email, UUID strategyId) {
        User user = currentUser(email);
        ContentStrategy strategy = ownedStrategy(strategyId, user.getId());

        // BR-10: tối ưu dựa trên dữ liệu — phải có ít nhất một bài đã thu analytics của brand này.
        boolean hasAnalyzedPosts = postRepository
                .existsBySchedule_ContentVersion_ContentItem_BrandProfile_IdAndStatusAndDeletedAtIsNullAndPostAnalyticsIsNotEmpty(
                        strategy.getBrandProfile().getId(), PostStatus.POSTED);
        if (!hasAnalyzedPosts) {
            throw new AppException(ErrorCode.NO_ANALYZED_POSTS);
        }

        StrategyOptimizationJob saved = jobRepository.save(strategyOptimizationMapper.toJob(strategy));

        // Dispatch worker SAU KHI commit (rule #28a) — cùng mẫu ContentGenerationServiceImpl.
        UUID jobId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    workerService.process(jobId);
                }
            });
        } else {
            workerService.process(jobId);
        }

        StrategyOptimizationJobResponse response = strategyOptimizationMapper.toJobResponse(saved, List.of());
        return ApiResponse.success("Đã bắt đầu tối ưu chiến lược", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<StrategyOptimizationJobResponse> getJob(String email, UUID jobId) {
        User user = currentUser(email);
        StrategyOptimizationJob job = jobRepository
                .findByIdAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(jobId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.STRATEGY_OPTIMIZATION_JOB_NOT_FOUND));

        // Đề xuất của lần chạy này = các đề xuất PENDING mới nhất của chiến lược sau khi job SUCCESS;
        // FE dùng danh sách đầy đủ ở GET /{strategyId}/adjustments (FR-67).
        List<StrategyAdjustment> adjustments = adjustmentRepository
                .findByStrategy_IdAndAppliedStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                        job.getContentStrategy().getId(), AppliedStatus.PENDING);
        List<StrategyAdjustmentResponse> adjustmentResponses = strategyOptimizationMapper.toResponseList(adjustments);

        StrategyOptimizationJobResponse response = strategyOptimizationMapper.toJobResponse(job, adjustmentResponses);
        return ApiResponse.success("Lấy trạng thái tác vụ tối ưu chiến lược thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<StrategyAdjustmentResponse>> listAdjustments(String email, UUID strategyId,
                                                                         AppliedStatus status) {
        User user = currentUser(email);
        ContentStrategy strategy = ownedStrategy(strategyId, user.getId());

        List<StrategyAdjustment> adjustments = status == null
                ? adjustmentRepository.findByStrategy_IdAndDeletedAtIsNullOrderByCreatedAtDesc(strategy.getId())
                : adjustmentRepository.findByStrategy_IdAndAppliedStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                        strategy.getId(), status);

        List<StrategyAdjustmentResponse> response = strategyOptimizationMapper.toResponseList(adjustments);
        return ApiResponse.success("Lấy lịch sử điều chỉnh chiến lược thành công", response);
    }

    @Override
    public ApiResponse<StrategyAdjustmentResponse> decide(String email, UUID adjustmentId,
                                                          AdjustmentDecisionRequest request) {
        User user = currentUser(email);
        StrategyAdjustment adjustment = adjustmentRepository
                .findByIdAndStrategy_BrandProfile_User_IdAndDeletedAtIsNull(adjustmentId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.ADJUSTMENT_NOT_FOUND));

        if (request.getStatus() != AppliedStatus.APPLIED && request.getStatus() != AppliedStatus.REJECTED) {
            throw new AppException(ErrorCode.INVALID_ADJUSTMENT_DECISION);
        }
        if (adjustment.getAppliedStatus() != AppliedStatus.PENDING) {
            throw new AppException(ErrorCode.ADJUSTMENT_ALREADY_DECIDED);
        }

        adjustment.setAppliedStatus(request.getStatus());
        adjustment.setDecidedAt(LocalDateTime.now());
        StrategyAdjustment saved = adjustmentRepository.save(adjustment);

        StrategyAdjustmentResponse response = strategyOptimizationMapper.toResponse(saved);
        return ApiResponse.success("Đã ghi nhận quyết định cho đề xuất", response);
    }

    private ContentStrategy ownedStrategy(UUID strategyId, UUID userId) {
        return contentStrategyRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(strategyId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND));
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }
}
