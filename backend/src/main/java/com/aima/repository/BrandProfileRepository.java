package com.aima.repository;

import com.aima.entity.BrandProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BrandProfileRepository extends JpaRepository<BrandProfile, UUID> {
    List<BrandProfile> findByUser_IdAndDeletedAtIsNull(UUID userId);
    Optional<BrandProfile> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);
    Optional<BrandProfile> findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(UUID userId);
}
