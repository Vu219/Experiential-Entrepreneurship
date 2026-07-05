package com.aima.repository;

import com.aima.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUser_IdAndReadAtIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUser_IdAndReadAtIsNullAndDeletedAtIsNull(UUID userId);

    Optional<Notification> findByIdAndUser_IdAndDeletedAtIsNull(UUID id, UUID userId);

    @Modifying(clearAutomatically = true)
    @Query("update Notification n set n.readAt = :now "
            + "where n.user.id = :userId and n.readAt is null and n.deletedAt is null")
    int markAllRead(@Param("userId") UUID userId, @Param("now") LocalDateTime now);
}
