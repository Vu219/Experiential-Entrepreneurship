package com.aima.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import com.aima.entity.BillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BillingRateRepository extends JpaRepository<BillingRate, UUID> {

    /** Toàn bộ lịch sử hệ số (bảng admin) — version mới nhất trước. */
    List<BillingRate> findByDeletedAtIsNullOrderByEffectiveFromDescCreatedAtDesc();

    /** Các dòng đang MỞ (effective_to null) — ít dòng, match scope cụ thể ở tầng service. */
    List<BillingRate> findByDeletedAtIsNullAndEffectiveToIsNull();

    // Xoá cứng tài khoản (admin): giữ bảng giá, bỏ FK tới người tạo.
    @Modifying(flushAutomatically = true)
    @Query("update BillingRate b set b.createdBy = null where b.createdBy.id = :userId")
    int clearCreatedBy(@Param("userId") UUID userId);
}
