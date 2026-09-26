package com.aima.repository;

import com.aima.entity.LandingSection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LandingSectionRepository extends JpaRepository<LandingSection, UUID> {

    List<LandingSection> findByDeletedAtIsNull();

    Optional<LandingSection> findBySectionKeyAndDeletedAtIsNull(String sectionKey);

    boolean existsBySectionKey(String sectionKey);
}
