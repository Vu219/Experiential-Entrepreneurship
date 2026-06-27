package com.aima.repository;

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
}
