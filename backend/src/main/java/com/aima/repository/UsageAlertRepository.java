package com.aima.repository;

import com.aima.entity.UsageAlert;
import com.aima.enums.UsageAlertRule;
import com.aima.enums.UsageAlertStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UsageAlertRepository extends JpaRepository<UsageAlert, UUID> {

    List<UsageAlert> findByStatusAndDeletedAtIsNullOrderByLastSeenDesc(UsageAlertStatus status, Pageable pageable);

    /** Alert OPEN của MỘT user (banner trang chi tiết). */
    List<UsageAlert> findByUserIdAndStatusAndDeletedAtIsNullOrderByLastSeenDesc(UUID userId, UsageAlertStatus status);

    /** Dòng OPEN cùng (rule, đối tượng) — có thì UPDATE (chống bão), userId null = alert hệ thống. */
    @Query("""
            select a from UsageAlert a
            where a.ruleCode = :rule and a.status = com.aima.enums.UsageAlertStatus.OPEN
              and a.deletedAt is null
              and ((:userId is null and a.userId is null) or a.userId = :userId)
            """)
    Optional<UsageAlert> findOpen(@Param("rule") UsageAlertRule rule, @Param("userId") UUID userId);

    /** Còn trong cooldown sau ACK? — rule không được bắn lại cho cùng đối tượng. */
    @Query("""
            select count(a) > 0 from UsageAlert a
            where a.ruleCode = :rule and a.status = com.aima.enums.UsageAlertStatus.ACKED
              and a.deletedAt is null and a.cooldownUntil > :now
              and ((:userId is null and a.userId is null) or a.userId = :userId)
            """)
    boolean inCooldown(@Param("rule") UsageAlertRule rule, @Param("userId") UUID userId,
                       @Param("now") LocalDateTime now);

    /** Báo cáo đo báo nhầm: mỗi rule tổng số alert + số bị đánh dấu false positive. */
    @Query("""
            select a.ruleCode as ruleCode, count(a) as total,
                   sum(case when a.falsePositive = true then 1 else 0 end) as falsePositives
            from UsageAlert a
            where a.deletedAt is null
            group by a.ruleCode
            order by count(a) desc
            """)
    List<RuleStatAgg> statsByRule();

    interface RuleStatAgg {
        UsageAlertRule getRuleCode();

        Long getTotal();

        Long getFalsePositives();
    }
}
