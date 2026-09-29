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
     * Fetch-join đủ model + provider của model chính, cột legacy và cả chuỗi dự phòng —
     * AiRuntimeConfigService đọc ngoài transaction (entity detached) nên không được để lazy.
     */
    @Query("""
            select r from AiTaskRouting r
            join fetch r.primaryModel pm
            join fetch pm.provider
            left join fetch r.fallbackModel fm
            left join fetch fm.provider
            left join fetch r.fallbacks f
            left join fetch f.model fbm
            left join fetch fbm.provider
            where r.taskCode = :taskCode and r.deletedAt is null
            """)
    Optional<AiTaskRouting> findWithModelsByTaskCode(@Param("taskCode") AiTaskCode taskCode);

    Optional<AiTaskRouting> findByIdAndDeletedAtIsNull(UUID id);

    List<AiTaskRouting> findByDeletedAtIsNullOrderByTaskCodeAsc();

    /** Fetch-join đủ model+provider (chính + chuỗi dự phòng) cho effective status / đếm nghiệp vụ đang dùng. */
    @Query("""
            select r from AiTaskRouting r
            join fetch r.primaryModel pm
            join fetch pm.provider
            left join fetch r.fallbackModel fm
            left join fetch fm.provider
            left join fetch r.fallbacks f
            left join fetch f.model fbm
            left join fetch fbm.provider
            where r.deletedAt is null
            order by r.taskCode asc
            """)
    List<AiTaskRouting> findAllWithModels();

    boolean existsByPrimaryModelAndDeletedAtIsNull(AiModel model);

    boolean existsByFallbackModelAndDeletedAtIsNull(AiModel model);
}
