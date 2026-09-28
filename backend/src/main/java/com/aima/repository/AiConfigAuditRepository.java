package com.aima.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import com.aima.entity.AiConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiConfigAuditRepository extends JpaRepository<AiConfigAudit, UUID> {

    Page<AiConfigAudit> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    // Xoá cứng tài khoản (admin): giữ vết audit, bỏ FK tới người thao tác.
    @Modifying(flushAutomatically = true)
    @Query("update AiConfigAudit a set a.actor = null where a.actor.id = :userId")
    int clearActor(@Param("userId") UUID userId);
}
