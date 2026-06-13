package com.aima.brand;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BrandProfileRepository extends JpaRepository<BrandProfile, UUID> {

    List<BrandProfile> findByUser_IdAndDeletedAtIsNull(UUID userId);

    Optional<BrandProfile> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
