package com.aima.repository;

import com.aima.entity.PlatformAvailability;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformAvailabilityRepository extends JpaRepository<PlatformAvailability, UUID> {

    Optional<PlatformAvailability> findByPlatformAndDeletedAtIsNull(Platform platform);

    List<PlatformAvailability> findByDeletedAtIsNull();
}
