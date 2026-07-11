package com.aima.repository;

import com.aima.entity.OptimizationInsight;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OptimizationInsightRepository extends JpaRepository<OptimizationInsight, UUID> {
}
