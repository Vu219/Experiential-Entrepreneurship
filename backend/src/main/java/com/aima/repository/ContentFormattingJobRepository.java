package com.aima.repository;

import com.aima.entity.ContentFormattingJob;
import com.aima.enums.GenerationJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentFormattingJobRepository extends JpaRepository<ContentFormattingJob, UUID> {

    // API-03/SEC-04: user chỉ xem job format trên nội dung của mình.
    Optional<ContentFormattingJob> findByIdAndContentItem_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Chống trùng: job còn đang chạy (PENDING/RUNNING) của cùng bài — so nền tảng ở service (cột platforms CSV).
    List<ContentFormattingJob> findByContentItem_IdAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID contentItemId, Collection<GenerationJobStatus> statuses);

    // Giới hạn số tác vụ AI chạy song song của một user (TokenUsageService.checkConcurrentAiJobs).
    long countByContentItem_BrandProfile_User_IdAndStatusInAndDeletedAtIsNull(UUID userId,
                                                                             Collection<GenerationJobStatus> statuses);

    // Job kẹt (worker chết / server restart): PENDING/RUNNING không cập nhật từ trước :threshold → FAILED.
    // Bulk update không kích hoạt @UpdateTimestamp nên set tay updatedAt (cùng mẫu ContentGenerationJobRepository).
    @Modifying(flushAutomatically = true)
    @Query("update ContentFormattingJob j set j.status = com.aima.enums.GenerationJobStatus.FAILED, "
            + "j.errorMessage = :errorMessage, j.updatedAt = :now "
            + "where j.status in (com.aima.enums.GenerationJobStatus.PENDING, com.aima.enums.GenerationJobStatus.RUNNING) "
            + "and j.updatedAt < :threshold and j.deletedAt is null")
    int failStuckJobs(@Param("threshold") LocalDateTime threshold, @Param("now") LocalDateTime now,
                      @Param("errorMessage") String errorMessage);
}
