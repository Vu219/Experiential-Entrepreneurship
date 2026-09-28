package com.aima.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import com.aima.entity.PlatformApiVersionHistory;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PlatformApiVersionHistoryRepository extends JpaRepository<PlatformApiVersionHistory, UUID> {

    List<PlatformApiVersionHistory> findByPlatformApiVersion_PlatformOrderByCreatedAtDesc(Platform platform);

    // Xoá cứng tài khoản (admin): giữ lịch sử version, bỏ FK tới người đổi.
    @Modifying(flushAutomatically = true)
    @Query("update PlatformApiVersionHistory h set h.changedBy = null where h.changedBy.id = :userId")
    int clearChangedBy(@Param("userId") UUID userId);
}
