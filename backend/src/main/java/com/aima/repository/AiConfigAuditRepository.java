package com.aima.repository;

import com.aima.entity.AiConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiConfigAuditRepository extends JpaRepository<AiConfigAudit, UUID> {

    Page<AiConfigAudit> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);
}
