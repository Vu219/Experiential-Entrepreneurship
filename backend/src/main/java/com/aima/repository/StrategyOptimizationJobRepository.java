package com.aima.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
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

    /** Giới hạn gói STRATEGY_OPTIMIZATION_PER_PERIOD: job trong kỳ, job FAILED không tính. */
    @Query("select count(j) from StrategyOptimizationJob j where j.contentStrategy.brandProfile.user.id = :userId "
            + "and j.status <> com.aima.enums.GenerationJobStatus.FAILED "
            + "and j.createdAt >= :from and j.createdAt < :to and j.deletedAt is null")
    long countInPeriod(@Param("userId") UUID userId, @Param("from") LocalDateTime from,
                       @Param("to") LocalDateTime to);
}
