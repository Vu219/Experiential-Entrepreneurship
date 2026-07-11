package com.aima.repository;

import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface SystemLogRepository extends JpaRepository<SystemLog, UUID> {

    Page<SystemLog> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    Page<SystemLog> findByLevelAndDeletedAtIsNullOrderByCreatedAtDesc(LogLevel level, Pageable pageable);

    Page<SystemLog> findByCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(
            LocalDateTime from, LocalDateTime to, Pageable pageable);

    Page<SystemLog> findByLevelAndCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(
            LogLevel level, LocalDateTime from, LocalDateTime to, Pageable pageable);
}
