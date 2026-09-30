package com.aima.repository;

import com.aima.entity.PostSchedule;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PostScheduleRepository extends JpaRepository<PostSchedule, UUID> {

    // Chống đăng trùng khi chạy nhiều instance: chỉ MỘT UPDATE đổi được SCHEDULED → POSTING
    // (row lock của Postgres tuần tự hoá hai UPDATE; cái sau thấy status đã đổi → 0 row).
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PostSchedule s set s.status = com.aima.enums.ScheduleStatus.POSTING "
            + "where s.id = :id and s.status = com.aima.enums.ScheduleStatus.SCHEDULED and s.deletedAt is null")
    int claimForPosting(@Param("id") UUID id);

    // API-03/SEC-04: user chỉ thao tác trên lịch gắn với tài khoản nền tảng của mình.
    Optional<PostSchedule> findByIdAndPlatformAccount_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    // FR-49: hàng đợi đăng bài — sắp theo thời gian đăng.
    List<PostSchedule> findByPlatformAccount_User_IdAndDeletedAtIsNullOrderByScheduledTimeAsc(UUID userId);

    List<PostSchedule> findByPlatformAccount_User_IdAndStatusAndDeletedAtIsNullOrderByScheduledTimeAsc(
            UUID userId, ScheduleStatus status);

    List<PostSchedule> findByPlatformAccount_User_IdAndContentVersion_PlatformNameAndDeletedAtIsNullOrderByScheduledTimeAsc(
            UUID userId, Platform platform);

    List<PostSchedule> findByPlatformAccount_User_IdAndStatusAndContentVersion_PlatformNameAndDeletedAtIsNullOrderByScheduledTimeAsc(
            UUID userId, ScheduleStatus status, Platform platform);

    // 1-1 ContentVersion → PostSchedule (unique content_version_id): lịch CANCELLED được tái sử dụng khi lên lịch lại.
    Optional<PostSchedule> findByContentVersion_IdAndDeletedAtIsNull(UUID contentVersionId);

    // Id bài của lịch — để khóa bài TRƯỚC khi nạp/đổi lịch (thứ tự khóa item → schedule).
    @Query("select s.contentVersion.contentItem.id from PostSchedule s where s.id = :id")
    Optional<UUID> findContentItemId(@Param("id") UUID id);

    // Như trên, có kiểm tra quyền sở hữu (luồng của user).
    @Query("select s.contentVersion.contentItem.id from PostSchedule s "
            + "where s.id = :id and s.platformAccount.user.id = :userId and s.deletedAt is null")
    Optional<UUID> findOwnedContentItemId(@Param("id") UUID id, @Param("userId") UUID userId);

    // Như trên cho hàng loạt lịch theo trạng thái của các tài khoản (tạm giữ khi token hết hạn / ngắt kết nối).
    @Query("select distinct s.contentVersion.contentItem.id from PostSchedule s "
            + "where s.platformAccount.id in :accountIds and s.status in :statuses and s.deletedAt is null")
    List<UUID> findContentItemIdsByAccounts(@Param("accountIds") Collection<UUID> accountIds,
                                            @Param("statuses") Collection<ScheduleStatus> statuses);

    // Như trên theo user (tài khoản chờ xóa, đổi policy duyệt).
    @Query("select distinct s.contentVersion.contentItem.id from PostSchedule s "
            + "where s.platformAccount.user.id = :userId and s.status in :statuses and s.deletedAt is null")
    List<UUID> findContentItemIdsByUser(@Param("userId") UUID userId,
                                        @Param("statuses") Collection<ScheduleStatus> statuses);

    List<PostSchedule> findByPlatformAccount_IdInAndStatusInAndDeletedAtIsNull(Collection<UUID> accountIds,
                                                                              Collection<ScheduleStatus> statuses);

    // Lịch chiếm chỗ của một tài khoản — cảnh báo trùng lịch, khung giờ gợi ý.
    List<PostSchedule> findByPlatformAccount_IdAndStatusInAndDeletedAtIsNull(UUID accountId,
                                                                            Collection<ScheduleStatus> statuses);

    List<PostSchedule> findByPlatformAccount_User_IdAndStatusInAndDeletedAtIsNull(UUID userId,
                                                                                 Collection<ScheduleStatus> statuses);

    // Lịch tạm giữ đã qua giờ đăng — nhắc user chọn giờ mới (HeldScheduleOverdueJob, gửi một lần/lịch).
    @Query("select s from PostSchedule s join fetch s.platformAccount a join fetch a.user "
            + "where s.status = com.aima.enums.ScheduleStatus.ON_HOLD and s.scheduledTime <= :now and s.deletedAt is null")
    List<PostSchedule> findHeldOverdue(@Param("now") Instant now);

    // Job sửa dữ liệu: lịch Instagram chưa đăng (MVP không tự đăng được) và lịch ON_HOLD chưa có lý do.
    List<PostSchedule> findByContentVersion_PlatformNameAndStatusInAndDeletedAtIsNull(Platform platform,
                                                                                  Collection<ScheduleStatus> statuses);

    @Query("select s.id from PostSchedule s where s.status = com.aima.enums.ScheduleStatus.ON_HOLD and s.deletedAt is null "
            + "and not exists (select h from PostScheduleHold h where h.schedule = s) order by s.id")
    List<UUID> findUnclassifiedHoldIds();

    // Lịch chưa đăng của một bài — đồng bộ lý do PENDING_REVIEW theo policy duyệt.
    List<PostSchedule> findByContentVersion_ContentItem_IdAndStatusInAndDeletedAtIsNull(UUID contentItemId,
                                                                                       Collection<ScheduleStatus> statuses);

    // FR-18b/FR-70: token hết hạn → các lịch SCHEDULED của tài khoản đó chuyển ON_HOLD.
    List<PostSchedule> findByPlatformAccount_IdAndStatusAndDeletedAtIsNull(UUID accountId, ScheduleStatus status);

    // FR-81: số lịch đang chờ đăng trên toàn hệ thống (trang System status của admin).
    long countByStatusAndDeletedAtIsNull(ScheduleStatus status);

    // FR-52 + tài khoản chờ xoá: lịch đến hạn, BỎ user đang ở trạng thái loại trừ (PENDING_DELETE).
    List<PostSchedule> findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNullAndPlatformAccount_User_StatusNot(
            ScheduleStatus status, Instant threshold, UserStatus excludedUserStatus);
}
