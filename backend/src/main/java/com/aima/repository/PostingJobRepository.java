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
import java.time.Instant;
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
    int claim(@Param("id") UUID id, @Param("now") Instant now);

    // Worker đăng bài: nạp đủ đồ thị cần cho lời gọi nền tảng trong MỘT query — worker copy ra
    // PublishTarget rồi đóng session, không để proxy lazy nào lọt ra ngoài transaction.
    @Query("select j from PostingJob j join fetch j.post p join fetch p.schedule s "
            + "join fetch s.platformAccount join fetch s.contentVersion where j.id = :id")
    Optional<PostingJob> findForPublish(@Param("id") UUID id);

    // Job RUNNING quá lâu = worker chết giữa chừng (crash/restart) — PostingDispatchJob vớt lại.
    List<PostingJob> findByStatusAndStartTimeLessThanEqualAndDeletedAtIsNull(
            PostingJobStatus status, Instant threshold);

    // Nhả job kẹt có điều kiện: 0 row = worker vừa kịp ghi kết quả (hoặc instance khác đã vớt).
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PostingJob j set j.status = com.aima.enums.PostingJobStatus.FAILED "
            + "where j.id = :id and j.status = com.aima.enums.PostingJobStatus.RUNNING and j.startTime <= :threshold")
    int releaseStuck(@Param("id") UUID id, @Param("threshold") Instant threshold);

    // ---- Tài khoản chờ xoá: dừng dispatch ----

    // Job chưa/chờ chạy của MỘT user — huỷ khi user yêu cầu xoá tài khoản.
    @Query("select j from PostingJob j join fetch j.post p join fetch p.schedule s "
            + "where s.platformAccount.user.id = :userId and j.status in :statuses and j.deletedAt is null")
    List<PostingJob> findInFlightByUser(@Param("userId") UUID userId,
                                        @Param("statuses") Collection<PostingJobStatus> statuses);

    // Id bài của các job trên — khóa bài trước khi dừng job/giữ lịch.
    @Query("select distinct j.post.schedule.contentVersion.contentItem.id from PostingJob j "
            + "where j.post.schedule.platformAccount.user.id = :userId and j.status in :statuses and j.deletedAt is null")
    List<UUID> findInFlightContentItemIdsByUser(@Param("userId") UUID userId,
                                                @Param("statuses") Collection<PostingJobStatus> statuses);

    // Id bài của job — worker khóa bài TRƯỚC khi claim/ghi kết quả (thứ tự khóa item → schedule → job).
    @Query("select j.post.schedule.contentVersion.contentItem.id from PostingJob j where j.id = :id")
    Optional<UUID> findContentItemId(@Param("id") UUID id);

    // Retry đến hạn — bỏ user đang ở trạng thái loại trừ (PENDING_DELETE, LOCKED).
    List<PostingJob> findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotIn(
            PostingJobStatus status, Instant threshold, Collection<UserStatus> excludedUserStatuses);

    // Như trên nhưng HOÃN retry của các nền tảng đang có sự cố diện rộng (PlatformIncidentService) — chỉ gọi khi
    // danh sách nền tảng khác rỗng.
    List<PostingJob> findByStatusAndNextRetryAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotInAndPost_PlatformNameNotIn(
            PostingJobStatus status, Instant threshold, Collection<UserStatus> excludedUserStatuses,
            Collection<com.aima.enums.Platform> deferredPlatforms);

    // Job PENDING mất dispatch — bỏ user đang ở trạng thái loại trừ (PENDING_DELETE, LOCKED).
    List<PostingJob> findByStatusAndCreatedAtLessThanEqualAndDeletedAtIsNullAndPost_Schedule_PlatformAccount_User_StatusNotIn(
            PostingJobStatus status, LocalDateTime threshold, Collection<UserStatus> excludedUserStatuses);

    // ===== Chuẩn hoá lỗi đăng bài (docs/failed-posts-error-handling-plan.md Phase 4) — JPQL để chạy cả trên H2 test

    /**
     * Phát hiện sự cố nền tảng: theo nền tảng, số lần lỗi TẠM THỜI + số kết nối RIÊNG BIỆT bị ảnh hưởng + lần lỗi đầu
     * từ {@code since}. Mỗi dòng [Platform, Long failures, Long accounts, Instant firstAt].
     */
    @Query("select p.platformName, count(j), count(distinct s.platformAccount.id), min(j.endTime) "
            + "from PostingJob j join j.post p join p.schedule s "
            + "where j.status = com.aima.enums.PostingJobStatus.FAILED and j.endTime >= :since and j.errorCode in :codes "
            + "group by p.platformName")
    List<Object[]> countFailuresByPlatformSince(@Param("since") Instant since,
                                                @Param("codes") Collection<com.aima.enums.PublishErrorCode> codes);

    /**
     * Hàng đợi "chưa phân loại" của admin: lần đăng lỗi trong [from, to) mã UNKNOWN, hoặc dòng cũ chưa có mã
     * (caller chuẩn hoá lúc đọc rồi giữ lại dòng ra UNKNOWN). Mới nhất trước, có trần qua Pageable.
     */
    @Query("select j from PostingJob j join fetch j.post p "
            + "where j.status = com.aima.enums.PostingJobStatus.FAILED and j.endTime >= :from and j.endTime < :to "
            + "and (j.errorCode = com.aima.enums.PublishErrorCode.UNKNOWN or j.errorCode is null) "
            + "order by j.endTime desc")
    List<PostingJob> findUnclassifiedCandidates(@Param("from") Instant from, @Param("to") Instant to,
                                                org.springframework.data.domain.Pageable pageable);

    /** Lần lỗi UNKNOWN cùng mã gốc trên một nền tảng — để áp ánh xạ mới của admin cho lỗi cũ. */
    @Query("select j from PostingJob j where j.status = com.aima.enums.PostingJobStatus.FAILED "
            + "and j.errorCode = com.aima.enums.PublishErrorCode.UNKNOWN "
            + "and j.platformErrorCode = :platformCode and j.post.platformName = :platform")
    List<PostingJob> findUnknownByPlatformCode(@Param("platform") com.aima.enums.Platform platform,
                                               @Param("platformCode") String platformCode);

    /**
     * Lần lỗi CUỐI của các bài thất bại CHUNG CUỘC (lịch FAILED) trong [from, to) — nguồn "mã lỗi hàng đầu" / phân
     * bố nền tảng của trang admin. Bỏ bài/kết nối đã xoá như bảng danh sách.
     */
    @Query("select j from PostingJob j join fetch j.post p "
            + "where j.status = com.aima.enums.PostingJobStatus.FAILED and j.endTime >= :from and j.endTime < :to "
            + "and p.deletedAt is null and p.status = com.aima.enums.PostStatus.FAILED "
            + "and p.schedule.status = com.aima.enums.ScheduleStatus.FAILED "
            + "and p.schedule.platformAccount.deletedAt is null "
            + "and not exists (select j2 from PostingJob j2 where j2.post = p "
            + "and j2.status = com.aima.enums.PostingJobStatus.FAILED and j2.endTime > j.endTime)")
    List<PostingJob> findFinalFailuresBetween(@Param("from") Instant from, @Param("to") Instant to);
}
