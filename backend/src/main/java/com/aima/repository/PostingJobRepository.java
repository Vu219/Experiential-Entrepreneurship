package com.aima.repository;

import com.aima.entity.PostingJob;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.UserStatus;
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
public interface PostingJobRepository extends JpaRepository<PostingJob, UUID> {

    // Claim nguyên tử: chỉ một worker chuyển được job sang RUNNING — chống double-publish khi
    // job bị dispatch trùng giữa hai lần quét của PostingDispatchJob.
    @Modifying
    @Query("update PostingJob j set j.status = com.aima.enums.PostingJobStatus.RUNNING, j.startTime = :now "
            + "where j.id = :id and j.status in (com.aima.enums.PostingJobStatus.PENDING, "
            + "com.aima.enums.PostingJobStatus.RETRYING)")
    int claim(@Param("id") UUID id, @Param("now") LocalDateTime now);

    // Worker đăng bài: nạp đủ đồ thị cần cho lời gọi nền tảng trong MỘT query — worker copy ra
    // PublishTarget rồi đóng session, không để proxy lazy nào lọt ra ngoài transaction.
    @Query("select j from PostingJob j join fetch j.post p join fetch p.schedule s "
            + "join fetch s.platformAccount join fetch s.contentVersion where j.id = :id")
    Optional<PostingJob> findForPublish(@Param("id") UUID id);

    // Job RUNNING quá lâu = worker chết giữa chừng (crash/restart) — PostingDispatchJob vớt lại.
    List<PostingJob> findByStatusAndStartTimeLessThanEqualAndDeletedAtIsNull(
            PostingJobStatus status, LocalDateTime threshold);

    // Nhả job kẹt có điều kiện: 0 row = worker vừa kịp ghi kết quả (hoặc instance khác đã vớt).
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PostingJob j set j.status = com.aima.enums.PostingJobStatus.FAILED "
            + "where j.id = :id and j.status = com.aima.enums.PostingJobStatus.RUNNING and j.startTime <= :threshold")
    int releaseStuck(@Param("id") UUID id, @Param("threshold") LocalDateTime threshold);

    // ---- Tài khoản chờ xoá: dừng dispatch ----

    // Job chưa/chờ chạy của MỘT user — huỷ khi user yêu cầu xoá tài khoản.
    @Query("select j from PostingJob j join fetch j.post p join fetch p.schedule s "
            + "where s.platformAccount.user.id = :userId and j.status in :statuses and j.deletedAt is null")
    List<PostingJob> findInFlightByUser(@Param("userId") UUID userId,
                                        @Param("statuses") Collection<PostingJobStatus> statuses);

    // Retry đến hạn — bỏ user đang ở trạng thái loại trừ (PENDING_DELETE).
    List<PostingJob> findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNot(
            PostingJobStatus status, LocalDateTime threshold, UserStatus excludedUserStatus);

    // Job PENDING mất dispatch — bỏ user đang ở trạng thái loại trừ (PENDING_DELETE).
    List<PostingJob> findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNot(
            PostingJobStatus status, LocalDateTime threshold, UserStatus excludedUserStatus);
}
