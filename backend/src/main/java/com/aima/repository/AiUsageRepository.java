package com.aima.repository;

import com.aima.entity.AiUsage;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AiUsageRepository extends JpaRepository<AiUsage, UUID> {

    Page<AiUsage> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Điều kiện lọc dùng chung của tab Nhật ký sử dụng (mọi tham số null = bỏ qua). Native +
     * {@code CAST(:param AS ...)} vì PostgreSQL không suy được kiểu của bind null trong biểu thức
     * {@code ? IS NULL} (SQLState 42P18) — mỗi lần xuất hiện của named param thành một positional
     * param riêng, nên occurrence đứng một mình trong {@code ? IS NULL} không có ngữ cảnh để suy kiểu.
     * Enum ({@code taskCode}/{@code status}) bind dạng String để so khớp cột lưu STRING (giống
     * {@link SystemLogRepository#search}).
     */
    String EVENT_FILTER = """
            deleted_at is null
            and (CAST(:from as timestamp) is null or created_at >= CAST(:from as timestamp))
            and (CAST(:to as timestamp) is null or created_at < CAST(:to as timestamp))
            and (CAST(:userId as uuid) is null or user_id = CAST(:userId as uuid))
            and (CAST(:taskCode as varchar) is null or task_code = CAST(:taskCode as varchar))
            and (CAST(:model as varchar) is null or model_code = CAST(:model as varchar))
            and (CAST(:status as varchar) is null or status = CAST(:status as varchar)
                 or (status is null and CAST(:status as varchar) = 'SUCCESS'))
            and (CAST(:minTokens as bigint) is null or total_tokens >= CAST(:minTokens as bigint))
            and (CAST(:minCost as numeric) is null or estimated_cost >= CAST(:minCost as numeric))
            """;

    /**
     * Tab Nhật ký sử dụng — phân trang OFFSET (trang có số, đúng pattern phân trang chung của
     * các trang quản trị). Đánh đổi có chủ ý so với keyset: {@code COUNT(*)} + {@code OFFSET}
     * chậm dần ở trang sâu, bù lại admin nhảy được tới trang bất kỳ và chia sẻ được link.
     * Sắp xếp phụ theo {@code id} để thứ tự ổn định khi hai event trùng {@code created_at}.
     * Các đường keyset bên dưới GIỮ LẠI cho export (quét tuần tự toàn bộ tập, không cần offset).
     */
    @Query(value = "select * from ai_usage where " + EVENT_FILTER
            + " order by created_at desc, id desc",
            countQuery = "select count(*) from ai_usage where " + EVENT_FILTER,
            nativeQuery = true)
    Page<AiUsage> searchEvents(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                               @Param("userId") UUID userId, @Param("taskCode") String taskCode,
                               @Param("model") String model, @Param("status") String status,
                               @Param("minTokens") Long minTokens, @Param("minCost") BigDecimal minCost,
                               Pageable pageable);

    /** Trang ĐẦU tab Nhật ký (keyset (created_at, id) DESC — không OFFSET); Pageable chỉ giữ limit. */
    @Query(value = "select * from ai_usage where " + EVENT_FILTER
            + " order by created_at desc, id desc", nativeQuery = true)
    List<AiUsage> findEventsFirstPage(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                      @Param("userId") UUID userId, @Param("taskCode") String taskCode,
                                      @Param("model") String model, @Param("status") String status,
                                      @Param("minTokens") Long minTokens, @Param("minCost") BigDecimal minCost,
                                      Pageable pageable);

    /** Trang KẾ theo cursor (createdAt, id) của dòng cuối trang trước. */
    @Query(value = """
            select * from ai_usage where (created_at < CAST(:cursorAt as timestamp)
                or (created_at = CAST(:cursorAt as timestamp) and id < CAST(:cursorId as uuid))) and
            """ + EVENT_FILTER + " order by created_at desc, id desc", nativeQuery = true)
    List<AiUsage> findEventsAfterCursor(@Param("cursorAt") LocalDateTime cursorAt, @Param("cursorId") UUID cursorId,
                                        @Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                        @Param("userId") UUID userId, @Param("taskCode") String taskCode,
                                        @Param("model") String model, @Param("status") String status,
                                        @Param("minTokens") Long minTokens, @Param("minCost") BigDecimal minCost,
                                        Pageable pageable);

    /** Đếm kết quả theo filter — hiện cạnh nút Export (chặn export > trần kèm số thực tế). */
    @Query(value = "select count(*) from ai_usage where " + EVENT_FILTER, nativeQuery = true)
    long countEvents(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                     @Param("userId") UUID userId, @Param("taskCode") String taskCode,
                     @Param("model") String model, @Param("status") String status,
                     @Param("minTokens") Long minTokens, @Param("minCost") BigDecimal minCost);

    /** IP/UA distinct của một user (tab Phiên & thiết bị) — bản ghi gần nhất trước. */
    @Query("""
            select u.clientIp as clientIp, u.userAgent as userAgent,
                   count(u) as requestCount, max(u.createdAt) as lastSeenAt
            from AiUsage u
            where u.user.id = :userId and u.clientIp is not null and u.deletedAt is null
            group by u.clientIp, u.userAgent
            order by max(u.createdAt) desc
            """)
    List<ClientAgg> aggregateClientsForUser(@Param("userId") UUID userId, Pageable pageable);

    interface ClientAgg {
        String getClientIp();

        String getUserAgent();

        Long getRequestCount();

        LocalDateTime getLastSeenAt();
    }

    // ===== Detection cho UsageAlertService (pha 5A — mỗi rule một cửa sổ `from` khác nhau) =====

    /**
     * Hoạt động theo TỪNG user từ mốc {@code from}: requests (R1), token billable thô — chưa
     * trừ credit vì đo lượng ĐỐT (R2/R3), cost (R6), distinct IP + UA (R4 — count distinct
     * tự bỏ null). Một query đa dụng, service gọi với cửa sổ 5'/1h/từ-0h tuỳ rule.
     */
    @Query("""
            select u.user.id as userId, count(u) as requests,
                   sum(coalesce(u.billableUnits, u.totalTokens)) as tokens,
                   sum(u.estimatedCost) as costUsd,
                   count(distinct u.clientIp) as distinctIps,
                   count(distinct u.userAgent) as distinctUas
            from AiUsage u
            where u.user is not null and u.createdAt >= :from and u.deletedAt is null
            group by u.user.id
            """)
    List<UserActivityAgg> activitySince(@Param("from") LocalDateTime from);

    /** R5 — tỉ lệ lỗi TOÀN HỆ THỐNG (một alert, không theo user); row cũ status null = SUCCESS. */
    @Query("""
            select count(u) as requests,
                   sum(case when u.status in (com.aima.enums.AiUsageStatus.ERROR,
                                              com.aima.enums.AiUsageStatus.TIMEOUT) then 1 else 0 end) as errors
            from AiUsage u
            where u.createdAt >= :from and u.deletedAt is null
            """)
    SystemErrorAgg systemErrorsSince(@Param("from") LocalDateTime from);

    /** R7 — phần credit không đủ trả (rò qua chỗ chặn) theo user từ mốc {@code from}. */
    @Query("""
            select u.user.id as userId, sum(u.creditShortfall) as shortfall
            from AiUsage u
            where u.user is not null and u.creditShortfall > 0
              and u.createdAt >= :from and u.deletedAt is null
            group by u.user.id
            """)
    List<ShortfallAgg> shortfallSince(@Param("from") LocalDateTime from);

    /** R9 — tổng cost toàn hệ thống từ mốc {@code from} (chốt chặn cuối). */
    @Query("select sum(u.estimatedCost) from AiUsage u where u.createdAt >= :from and u.deletedAt is null")
    BigDecimal systemCostSince(@Param("from") LocalDateTime from);

    interface UserActivityAgg {
        UUID getUserId();

        Long getRequests();

        Long getTokens();

        BigDecimal getCostUsd();

        Long getDistinctIps();

        Long getDistinctUas();
    }

    interface SystemErrorAgg {
        Long getRequests();

        Long getErrors();
    }

    interface ShortfallAgg {
        UUID getUserId();

        Long getShortfall();
    }

    /** Tổng hợp theo nghiệp vụ trong một khoảng thời gian (trang "Sử dụng & chi phí"). */
    @Query("""
            select u.taskCode as taskCode, sum(u.totalTokens) as totalTokens, sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.taskCode
            order by sum(u.totalTokens) desc
            """)
    List<TaskUsageAgg> aggregateByTask(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Tổng hợp theo model trong một khoảng thời gian. */
    @Query("""
            select u.providerCode as providerCode, u.modelCode as modelCode,
                   sum(u.totalTokens) as totalTokens, sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.providerCode, u.modelCode
            order by sum(u.totalTokens) desc
            """)
    List<ModelUsageAgg> aggregateByModel(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Mức dùng TRỪ VÀO HẠN MỨC GÓI của một user trong cửa sổ (đối chiếu hạn mức + reconcile
     * cache): SUM(billable_units) − SUM(credit_units) — phần trả bằng token mua thêm KHÔNG
     * tính vào hạn mức gói (không thì planUsed vượt limit vĩnh viễn sau khi tiêu credit).
     * Row cũ chưa có billable_units → coalesce total_tokens; credit_units null = 0;
     * row ERROR/TIMEOUT billable = 0 nên không tính.
     */
    @Query("""
            select coalesce(sum(coalesce(u.billableUnits, u.totalTokens) - coalesce(u.creditUnits, 0)), 0)
            from AiUsage u
            where u.user.id = :userId and u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            """)
    long sumTokensForUser(@Param("userId") UUID userId,
                          @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to);

    /** Tổng đã trả bằng token mua thêm + phần thiếu ("rò") của một user trong cửa sổ. */
    @Query("""
            select coalesce(sum(u.creditUnits), 0) as creditUsed, coalesce(sum(u.creditShortfall), 0) as creditShortfall
            from AiUsage u
            where u.user.id = :userId and u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            """)
    CreditAgg sumCreditForUser(@Param("userId") UUID userId,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to);

    interface CreditAgg {
        Long getCreditUsed();

        Long getCreditShortfall();
    }

    /** Tổng hợp theo nghiệp vụ của MỘT user (breakdown trang usage user). */
    @Query("""
            select u.taskCode as taskCode, sum(u.totalTokens) as totalTokens, sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.user.id = :userId and u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.taskCode
            order by sum(u.totalTokens) desc
            """)
    List<TaskUsageAgg> aggregateByTaskForUser(@Param("userId") UUID userId,
                                              @Param("from") LocalDateTime from,
                                              @Param("to") LocalDateTime to);

    /**
     * Token theo NGÀY trong kỳ của một user (biểu đồ trang usage). Kỳ hiện tại là một
     * tháng lịch nên chỉ cần day-of-month; đổi sang bucket đầy đủ khi có chu kỳ khác.
     */
    @Query("""
            select day(u.createdAt) as dayOfMonth, sum(u.totalTokens) as totalTokens
            from AiUsage u
            where u.user.id = :userId and u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by day(u.createdAt)
            order by day(u.createdAt)
            """)
    List<DailyUsageAgg> aggregateDailyForUser(@Param("userId") UUID userId,
                                              @Param("from") LocalDateTime from,
                                              @Param("to") LocalDateTime to);

    /**
     * Token quy đổi (trừ hạn mức) + chi phí theo TỪNG user trong cửa sổ thời gian
     * (admin per-plan/per-user). billableUnits coalesce như {@link #sumTokensForUser}.
     */
    @Query("""
            select u.user.id as userId,
                   sum(coalesce(u.billableUnits, u.totalTokens) - coalesce(u.creditUnits, 0)) as billableUnits,
                   sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.user is not null and u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.user.id
            """)
    List<UserUsageAgg> aggregateByUser(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface UserUsageAgg {
        UUID getUserId();

        Long getBillableUnits();

        BigDecimal getEstimatedCost();
    }

    interface DailyUsageAgg {
        Integer getDayOfMonth();

        Long getTotalTokens();
    }

    interface TaskUsageAgg {
        AiTaskCode getTaskCode();

        Long getTotalTokens();

        BigDecimal getEstimatedCost();
    }

    interface ModelUsageAgg {
        AiProviderCode getProviderCode();

        String getModelCode();

        Long getTotalTokens();

        BigDecimal getEstimatedCost();
    }
}
