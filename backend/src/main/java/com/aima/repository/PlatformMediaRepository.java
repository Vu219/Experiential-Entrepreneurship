package com.aima.repository;

import com.aima.entity.PlatformMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformMediaRepository extends JpaRepository<PlatformMedia, UUID> {

    Optional<PlatformMedia> findByPost_Id(UUID postId);
}
