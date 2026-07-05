package com.aima.repository;

import com.aima.entity.PostingJob;
import com.aima.enums.PostingJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PostingJobRepository extends JpaRepository<PostingJob, UUID> {

    // Claim nguyên tử: chỉ một worker chuyển được job sang RUNNING — chống double-publish khi
    // job bị dispatch trùng giữa hai lần quét của PostingDispatchJob.
    @Modifying
    @Query("update PostingJob j set j.status = com.aima.enums.PostingJobStatus.RUNNING, j.startTime = :now "
            + "where j.id = :id and j.status in (com.aima.enums.PostingJobStatus.PENDING, "
            + "com.aima.enums.PostingJobStatus.RETRYING)")
    int claim(@Param("id") UUID id, @Param("now") LocalDateTime now);

    // FR-56: các retry đến hạn chạy.
    List<PostingJob> findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNull(
            PostingJobStatus status, LocalDateTime threshold);

    // Vớt job PENDING bị mất dispatch (app crash giữa tạo job và chạy worker).
    List<PostingJob> findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNull(
            PostingJobStatus status, LocalDateTime threshold);
}
