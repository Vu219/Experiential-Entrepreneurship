package com.aima.repository;

import com.aima.entity.SubscriptionHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SubscriptionHistoryRepository extends JpaRepository<SubscriptionHistory, UUID> {

    /** Lịch sử gói của một user, mới nhất trước — nguồn tab "Gói dịch vụ" của admin. */
    Page<SubscriptionHistory> findByUser_IdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
