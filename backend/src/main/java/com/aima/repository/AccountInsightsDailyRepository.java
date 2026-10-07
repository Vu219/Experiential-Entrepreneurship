package com.aima.repository;

import com.aima.entity.AccountInsightsDaily;
import com.aima.repository.projection.FollowerGrowthProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AccountInsightsDailyRepository extends JpaRepository<AccountInsightsDaily, UUID> {

    List<AccountInsightsDaily> findByPlatformAccount_IdAndMetricDateIn(UUID platformAccountId,
                                                                       Collection<LocalDate> metricDates);

    boolean existsByPlatformAccount_IdAndDeletedAtIsNull(UUID platformAccountId);

    /*
     * Ô "Người theo dõi mới" của trang Phân tích: số liệu CẤP TRANG nên chỉ áp bộ lọc nền tảng (không có loại nội
     * dung / nguồn bài). platformCsv giống PostAnalyticsRepository (null = mọi nền tảng). Scope theo user (API-03).
     */

    @Query(value = """
            select cast(sum(i.follows) as bigint) as follows,
                   count(i.follows) as samples
            from account_insights_daily i
            join platform_accounts pa on pa.id = i.platform_account_id and pa.deleted_at is null
            where pa.user_id = :userId
              and i.deleted_at is null
              and i.metric_date >= cast(:from as date)
              and i.metric_date <= cast(:to as date)
              and (cast(:platformCsv as text) is null
                   or pa.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
            """, nativeQuery = true)
    FollowerGrowthProjection findFollowerGrowthForUser(@Param("userId") UUID userId,
                                                       @Param("from") LocalDate from,
                                                       @Param("to") LocalDate to,
                                                       @Param("platformCsv") String platformCsv);

    /** Tổng người theo dõi hiện tại = số mới nhất của từng kênh cộng lại; null khi chưa kênh nào có số. */
    @Query(value = """
            select cast(sum(la.followers_count) as bigint)
            from platform_accounts pa
            join lateral (
                select i.followers_count
                from account_insights_daily i
                where i.platform_account_id = pa.id and i.deleted_at is null and i.followers_count is not null
                  and i.metric_date <= cast(now() at time zone 'Asia/Ho_Chi_Minh' as date)
                order by i.metric_date desc
                limit 1
            ) la on true
            where pa.user_id = :userId
              and pa.deleted_at is null
              and (cast(:platformCsv as text) is null
                   or pa.platform_name = any(string_to_array(cast(:platformCsv as text), ',')))
            """, nativeQuery = true)
    Long findFollowersTotalForUser(@Param("userId") UUID userId, @Param("platformCsv") String platformCsv);

    /** Dev-seed clear: chỉ dùng cho tài khoản MẪU. */
    @Modifying
    @Query("delete from AccountInsightsDaily i where i.platformAccount.id in :accountIds")
    int deleteForAccounts(@Param("accountIds") Collection<UUID> accountIds);
}
