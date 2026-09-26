package com.aima.repository;

import com.aima.entity.UsageHourly;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Đọc rollup giờ cho tab Tổng quan + heatmap — KHÔNG query thẳng event ai_usage. */
public interface UsageHourlyRepository extends JpaRepository<UsageHourly, UUID> {

    @Query("""
            select coalesce(sum(h.requests), 0) as requests, coalesce(sum(h.errors), 0) as errors,
                   coalesce(sum(h.totalTokens), 0) as totalTokens,
                   coalesce(sum(h.billableUnits), 0) as billableUnits,
                   coalesce(sum(h.creditUnits), 0) as creditUnits, sum(h.costUsd) as costUsd
            from UsageHourly h
            where h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            """)
    TotalsAgg totals(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select h.taskCode as taskCode, sum(h.totalTokens) as totalTokens, sum(h.requests) as requests,
                   sum(h.errors) as errors, sum(h.costUsd) as costUsd
            from UsageHourly h
            where h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.taskCode
            order by sum(h.totalTokens) desc
            """)
    List<TaskAgg> byTask(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select h.providerCode as providerCode, h.modelCode as modelCode,
                   sum(h.totalTokens) as totalTokens, sum(h.costUsd) as costUsd
            from UsageHourly h
            where h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.providerCode, h.modelCode
            order by sum(h.totalTokens) desc
            """)
    List<ModelAgg> byModel(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Top user theo token — truyền Pageable để giới hạn (vd top 10). */
    @Query("""
            select h.userId as userId, sum(h.totalTokens) as totalTokens, sum(h.costUsd) as costUsd
            from UsageHourly h
            where h.userId is not null and h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.userId
            order by sum(h.totalTokens) desc
            """)
    List<UserAgg> topUsers(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, Pageable pageable);

    /**
     * Mức dùng quy đổi hạn mức (billable − credit, cùng công thức enforcement) + chi phí theo user trong
     * khoảng — cho tab Theo gói/Theo người dùng khi xem LỊCH SỬ (event thô có thể đã bị retention xoá,
     * rollup thì còn).
     */
    @Query("""
            select h.userId as userId,
                   sum(coalesce(h.billableUnits, 0) - coalesce(h.creditUnits, 0)) as billableUnits,
                   sum(h.costUsd) as costUsd
            from UsageHourly h
            where h.userId is not null and h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.userId
            """)
    List<UserBillableAgg> billableByUser(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Điểm heatmap toàn hệ thống — FE tự chọn metric (token/request/cost/latency) phía client. */
    @Query("""
            select h.hourBucket as hourBucket, sum(h.totalTokens) as totalTokens, sum(h.requests) as requests,
                   sum(h.errors) as errors, sum(h.costUsd) as costUsd,
                   sum(h.latencySumMs) as latencySumMs, sum(h.latencyCount) as latencyCount
            from UsageHourly h
            where h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.hourBucket
            order by h.hourBucket
            """)
    List<HeatPoint> heatmap(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Heatmap của MỘT user (trang chi tiết user pha sau — soi hoạt động bất thường 3h sáng). */
    @Query("""
            select h.hourBucket as hourBucket, sum(h.totalTokens) as totalTokens, sum(h.requests) as requests,
                   sum(h.errors) as errors, sum(h.costUsd) as costUsd,
                   sum(h.latencySumMs) as latencySumMs, sum(h.latencyCount) as latencyCount
            from UsageHourly h
            where h.userId = :userId and h.hourBucket >= :from and h.hourBucket < :to and h.deletedAt is null
            group by h.hourBucket
            order by h.hourBucket
            """)
    List<HeatPoint> heatmapForUser(@Param("userId") UUID userId,
                                   @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface TotalsAgg {
        Long getRequests();

        Long getErrors();

        Long getTotalTokens();

        Long getBillableUnits();

        Long getCreditUnits();

        BigDecimal getCostUsd();
    }

    interface TaskAgg {
        AiTaskCode getTaskCode();

        Long getTotalTokens();

        Long getRequests();

        Long getErrors();

        BigDecimal getCostUsd();
    }

    interface ModelAgg {
        AiProviderCode getProviderCode();

        String getModelCode();

        Long getTotalTokens();

        BigDecimal getCostUsd();
    }

    interface UserBillableAgg {
        UUID getUserId();

        Long getBillableUnits();

        BigDecimal getCostUsd();
    }

    interface UserAgg {
        UUID getUserId();

        Long getTotalTokens();

        BigDecimal getCostUsd();
    }

    interface HeatPoint {
        LocalDateTime getHourBucket();

        Long getTotalTokens();

        Long getRequests();

        Long getErrors();

        BigDecimal getCostUsd();

        Long getLatencySumMs();

        Long getLatencyCount();
    }
}
