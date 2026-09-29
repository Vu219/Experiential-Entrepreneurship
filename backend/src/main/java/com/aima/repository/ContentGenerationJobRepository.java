package com.aima.repository;

import com.aima.entity.ContentGenerationJob;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContentGenerationJobRepository extends JpaRepository<ContentGenerationJob, UUID> {
    Optional<ContentGenerationJob> findByIdAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Chống trùng #1: cùng Idempotency-Key của CÙNG user → trả lại job cũ (mọi trạng thái).
    Optional<ContentGenerationJob> findFirstByIdempotencyKeyAndContentStrategy_BrandProfile_User_IdAndDeletedAtIsNull(
            String idempotencyKey, UUID userId);

    // Chống trùng #2: job còn đang chạy (PENDING/RUNNING) cho cùng bài + nền tảng.
    Optional<ContentGenerationJob> findFirstByContentItem_IdAndPlatformAndStatusInAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID contentItemId, Platform platform, Collection<GenerationJobStatus> statuses);

    // Job kẹt (server restart giữa chừng / worker chết): PENDING/RUNNING không cập nhật từ trước
    // :threshold → FAILED + AI_TIMEOUT. Bulk update không kích hoạt @UpdateTimestamp nên set tay updatedAt.
    @Modifying(flushAutomatically = true)
    @Query("update ContentGenerationJob j set j.status = com.aima.enums.GenerationJobStatus.FAILED, "
            + "j.errorCode = :errorCode, j.errorMessage = :errorMessage, j.updatedAt = :now "
            + "where j.status in (com.aima.enums.GenerationJobStatus.PENDING, com.aima.enums.GenerationJobStatus.RUNNING) "
            + "and j.updatedAt < :threshold and j.deletedAt is null")
    int failStuckJobs(@Param("threshold") LocalDateTime threshold, @Param("now") LocalDateTime now,
                      @Param("errorCode") String errorCode, @Param("errorMessage") String errorMessage);
}
