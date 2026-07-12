package com.aima.repository;

import com.aima.entity.PlanFeature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanFeatureRepository extends JpaRepository<PlanFeature, UUID> {

    List<PlanFeature> findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc();

    Optional<PlanFeature> findByIdAndDeletedAtIsNull(UUID id);

    long countByDeletedAtIsNull();
}
