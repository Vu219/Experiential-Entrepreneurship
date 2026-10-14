package com.aima.repository;

import com.aima.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID>, JpaSpecificationExecutor<Notification> {

    Page<Notification> findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUser_IdAndReadAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUser_IdAndReadAtIsNullAndDeletedAtIsNull(UUID userId);

    Optional<Notification> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);

    @Modifying(clearAutomatically = true)
    @Query("update Notification n set n.readAt = :now "
            + "where n.user.id = :userId and n.readAt is null and n.deletedAt is null")
    int markAllRead(@Param("userId") UUID userId, @Param("now") LocalDateTime now);

    boolean existsByDedupeKey(String dedupeKey);

    /** Xoá mềm mọi thông báo ĐÃ ĐỌC của user ("Xoá thông báo đã đọc"). */
    @Modifying(clearAutomatically = true)
    @Query("update Notification n set n.deletedAt = :now "
            + "where n.user.id = :userId and n.readAt is not null and n.deletedAt is null")
    int softDeleteRead(@Param("userId") UUID userId, @Param("now") LocalDateTime now);

    /**
     * Dọn thông báo cũ (D6) — XOÁ CỨNG, ngoại lệ đã chốt của rule soft-delete: đã đọc tạo trước {@code readBefore},
     * mọi thông báo tạo trước {@code allBefore}, đã xoá mềm trước {@code deletedBefore}.
     */
    @Modifying
    @Query("delete from Notification n where (n.readAt is not null and n.createdAt < :readBefore) "
            + "or n.createdAt < :allBefore or (n.deletedAt is not null and n.deletedAt < :deletedBefore)")
    int purgeExpired(@Param("readBefore") LocalDateTime readBefore, @Param("allBefore") LocalDateTime allBefore,
                     @Param("deletedBefore") LocalDateTime deletedBefore);

    /** Phát bù khi luồng SSE nối lại: thông báo tạo từ mốc {@code from} (gồm cả mốc — loại trùng ở FE theo id). */
    List<Notification> findByUser_IdAndDeletedAtIsNullAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
            UUID userId, LocalDateTime from, Pageable pageable);
}
