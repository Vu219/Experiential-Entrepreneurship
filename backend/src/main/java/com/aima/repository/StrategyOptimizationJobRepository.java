package com.aima.repository;

import com.aima.entity.StrategyOptimizationJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StrategyOptimizationJobRepository extends JpaRepository<StrategyOptimizationJob, UUID> {

    Optional<StrategyOptimizationJob> findByIdAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(
            UUID id, UUID userId);
}
