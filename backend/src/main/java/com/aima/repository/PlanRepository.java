package com.aima.repository;

import com.aima.entity.Plan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

    List<Plan> findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();

    List<Plan> findByIsActiveTrueAndDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();

    Optional<Plan> findByIdAndDeletedAtIsNull(UUID id);

    Optional<Plan> findByCodeAndDeletedAtIsNull(String code);

    boolean existsByCodeAndDeletedAtIsNull(String code);

    long countByDeletedAtIsNull();
}
