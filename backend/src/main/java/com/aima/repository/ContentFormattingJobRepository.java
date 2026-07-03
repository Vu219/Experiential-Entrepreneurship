package com.aima.repository;

import com.aima.entity.ContentFormattingJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentFormattingJobRepository extends JpaRepository<ContentFormattingJob, UUID> {

    // API-03/SEC-04: user chỉ xem job format trên nội dung của mình.
    Optional<ContentFormattingJob> findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);
}
