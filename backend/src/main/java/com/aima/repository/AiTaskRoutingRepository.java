package com.aima.repository;

import com.aima.entity.AiModel;
import com.aima.entity.AiTaskRouting;
import com.aima.enums.AiTaskCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiTaskRoutingRepository extends JpaRepository<AiTaskRouting, UUID> {

    Optional<AiTaskRouting> findByTaskCodeAndDeletedAtIsNull(AiTaskCode taskCode);

    /**
     * Fetch-join đủ model + provider hai nhánh — AiRuntimeConfigService đọc ngoài transaction
     * (entity detached) nên không được để lazy.
     */
    @Query("""
            select r from AiTaskRouting r
            join fetch r.primaryModel pm
            join fetch pm.provider
            left join fetch r.fallbackModel fm
            left join fetch fm.provider
            where r.taskCode = :taskCode and r.deletedAt is null
            """)
    Optional<AiTaskRouting> findWithModelsByTaskCode(@Param("taskCode") AiTaskCode taskCode);

    Optional<AiTaskRouting> findByIdAndDeletedAtIsNull(UUID id);

    List<AiTaskRouting> findByDeletedAtIsNullOrderByTaskCodeAsc();

    boolean existsByPrimaryModelAndDeletedAtIsNull(AiModel model);

    boolean existsByFallbackModelAndDeletedAtIsNull(AiModel model);
}
