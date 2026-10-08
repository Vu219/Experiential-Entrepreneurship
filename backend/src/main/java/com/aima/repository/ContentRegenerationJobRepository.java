package com.aima.repository;

import com.aima.entity.ContentRegenerationJob;
import com.aima.enums.GenerationJobStatus;
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
public interface ContentRegenerationJobRepository extends JpaRepository<ContentRegenerationJob, UUID> {

    // API-03/SEC-04: job chỉ đọc được bởi chủ nhân (qua version → item → brand profile → user).
    Optional<ContentRegenerationJob> findByIdAndContentVersion_ContentItem_BrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // Giới hạn số tác vụ AI chạy song song của một user (TokenUsageService.checkConcurrentAiJobs).
    long countByContentVersion_ContentItem_BrandProfile_User_IdAndStatusInAndDeletedAtIsNull(
            UUID userId, Collection<GenerationJobStatus> statuses);

    // Job kẹt (worker chết / server restart): PENDING/RUNNING không cập nhật từ trước :threshold → FAILED.
    // Bulk update không kích hoạt @UpdateTimestamp nên set tay updatedAt (cùng mẫu ContentGenerationJobRepository).
    @Modifying(flushAutomatically = true)
    @Query("update ContentRegenerationJob j set j.status = com.aima.enums.GenerationJobStatus.FAILED, "
            + "j.errorMessage = :errorMessage, j.updatedAt = :now "
            + "where j.status in (com.aima.enums.GenerationJobStatus.PENDING, com.aima.enums.GenerationJobStatus.RUNNING) "
            + "and j.updatedAt < :threshold and j.deletedAt is null")
    int failStuckJobs(@Param("threshold") LocalDateTime threshold, @Param("now") LocalDateTime now,
                      @Param("errorMessage") String errorMessage);
}
