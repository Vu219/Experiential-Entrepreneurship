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

import java.time.LocalDateTime;
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

    // Cùng item còn bản khác đang trong pipeline đăng không — để hạ trạng thái item khi hủy lịch.
    boolean existsByContentVersion_ContentItem_IdAndStatusInAndDeletedAtIsNull(
            UUID contentItemId, List<ScheduleStatus> statuses);

    // FR-18b/FR-70: token hết hạn → các lịch SCHEDULED của tài khoản đó chuyển ON_HOLD.
    List<PostSchedule> findByPlatformAccount_IdAndStatusAndDeletedAtIsNull(UUID accountId, ScheduleStatus status);

    // FR-81: số lịch đang chờ đăng trên toàn hệ thống (trang System status của admin).
    long countByStatusAndDeletedAtIsNull(ScheduleStatus status);

    // FR-52 + tài khoản chờ xoá: lịch đến hạn, BỎ user đang ở trạng thái loại trừ (PENDING_DELETE).
    List<PostSchedule> findByStatusAndScheduledTimeLessThanEqualAndDeletedAtIsNullAndPlatformAccount_User_StatusNot(
            ScheduleStatus status, LocalDateTime threshold, UserStatus excludedUserStatus);
}
