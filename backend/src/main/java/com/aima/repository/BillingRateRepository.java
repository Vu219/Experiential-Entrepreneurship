package com.aima.repository;

import com.aima.entity.BillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BillingRateRepository extends JpaRepository<BillingRate, UUID> {

    /** Toàn bộ lịch sử hệ số (bảng admin) — version mới nhất trước. */
    List<BillingRate> findByDeletedAtIsNullOrderByEffectiveFromDescCreatedAtDesc();

    /** Các dòng đang MỞ (effective_to null) — ít dòng, match scope cụ thể ở tầng service. */
    List<BillingRate> findByDeletedAtIsNullAndEffectiveToIsNull();
}
