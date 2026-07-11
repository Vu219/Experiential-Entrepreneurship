package com.aima.repository;

import com.aima.entity.StrategyAdjustment;
import com.aima.enums.AppliedStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StrategyAdjustmentRepository extends JpaRepository<StrategyAdjustment, UUID> {

    // FR-67: lịch sử điều chỉnh của một chiến lược, mới nhất trước.
    List<StrategyAdjustment> findByStrategy_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID strategyId);

    List<StrategyAdjustment> findByStrategy_IdAndAppliedStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID strategyId, AppliedStatus status);

    Optional<StrategyAdjustment> findByIdAndStrategy_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
