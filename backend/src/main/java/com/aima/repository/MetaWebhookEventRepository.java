package com.aima.repository;

import com.aima.entity.MetaWebhookEvent;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MetaWebhookEventRepository extends JpaRepository<MetaWebhookEvent, UUID> {

    boolean existsByDedupeKey(String dedupeKey);

    /** Khoá dòng khi xử lý — worker async và job quét lại không bao giờ xử lý cùng một sự kiện hai lần. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from MetaWebhookEvent e where e.id = :id")
    Optional<MetaWebhookEvent> lockById(@Param("id") UUID id);

    /** Sự kiện còn PENDING sau {@code before} — worker async chưa chạy được (app dừng giữa chừng / lỗi) → job quét lại. */
    @Query("select e.id from MetaWebhookEvent e where e.status = com.aima.enums.WebhookEventStatus.PENDING "
            + "and e.createdAt < :before order by e.createdAt")
    List<UUID> findStalePending(@Param("before") LocalDateTime before, Pageable pageable);
}
