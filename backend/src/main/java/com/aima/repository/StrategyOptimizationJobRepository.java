package com.aima.repository;

import com.aima.entity.StrategyOptimizationJob;
import com.aima.enums.GenerationJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface StrategyOptimizationJobRepository extends JpaRepository<StrategyOptimizationJob, UUID> {

    Optional<StrategyOptimizationJob> findByIdAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(
            UUID id, UUID userId);

    // Job đang chạy của chiến lược (chống bấm tối ưu nhiều lần → gọi AI/tính phí trùng); chỉ xét job tạo sau mốc.
    Optional<StrategyOptimizationJob> findFirstByContentStrategy_IdAndStatusInAndCreatedAtAfterAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID strategyId, Collection<GenerationJobStatus> statuses, LocalDateTime createdAfter);
}
