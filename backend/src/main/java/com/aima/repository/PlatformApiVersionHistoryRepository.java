package com.aima.repository;

import com.aima.entity.PlatformApiVersionHistory;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PlatformApiVersionHistoryRepository extends JpaRepository<PlatformApiVersionHistory, UUID> {

    List<PlatformApiVersionHistory> findByPlatformApiVersion_PlatformOrderByCreatedAtDesc(Platform platform);
}
