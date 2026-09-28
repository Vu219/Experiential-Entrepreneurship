package com.aima.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import com.aima.entity.PlatformApiVersion;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformApiVersionRepository extends JpaRepository<PlatformApiVersion, UUID> {

    Optional<PlatformApiVersion> findByPlatform(Platform platform);

    boolean existsByPlatform(Platform platform);

    // Xoá cứng tài khoản (admin): bỏ FK tới người cập nhật version.
    @Modifying(flushAutomatically = true)
    @Query("update PlatformApiVersion v set v.updatedBy = null where v.updatedBy.id = :userId")
    int clearUpdatedBy(@Param("userId") UUID userId);
}
