package com.aima.repository;

import com.aima.entity.UsageDaily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Đọc rollup ngày — hiện dùng cho baseline R3 (trung bình 7 ngày) của UsageAlertService. */
public interface UsageDailyRepository extends JpaRepository<UsageDaily, UUID> {

    /**
     * Baseline R3: tổng token + SỐ NGÀY CÓ HOẠT ĐỘNG của từng user trong cửa sổ. Rule chỉ
     * tính trung bình khi activeDays ≥ ngưỡng — không chia cho mẫu số nhỏ (tránh báo nhầm
     * user mới/quay lại sau kỳ nghỉ).
     */
    @Query("""
            select d.userId as userId, sum(d.totalTokens) as tokens,
                   count(distinct d.dayBucket) as activeDays
            from UsageDaily d
            where d.userId is not null and d.dayBucket >= :from and d.dayBucket < :to
              and d.deletedAt is null
            group by d.userId
            """)
    List<BaselineAgg> baseline(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface BaselineAgg {
        UUID getUserId();

        Long getTokens();

        Long getActiveDays();
    }
}
