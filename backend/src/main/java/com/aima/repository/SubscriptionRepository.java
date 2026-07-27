package com.aima.repository;

import com.aima.entity.Subscription;
import com.aima.enums.SubscriptionStatus;
import com.aima.repository.projection.PlanSubscriptionProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    /**
     * Fetch-join plan: caller (checkQuota từ scheduler) có thể đọc plan SAU khi transaction
     * của getOrCreate đóng — không để lazy proxy gây LazyInitializationException.
     */
    @Query("""
            select s from Subscription s
            join fetch s.plan
            where s.user.id = :userId and s.deletedAt is null
            """)
    Optional<Subscription> findWithPlanByUserId(@Param("userId") UUID userId);

    /** Id các user đã có subscription — cho seed idempotent (SubscriptionDataInitializer). */
    @Query("select s.user.id from Subscription s where s.deletedAt is null")
    List<UUID> findActiveUserIds();

    /**
     * Tổng quan quản trị (UI-10) — gộp ở tầng DB số người đăng ký của TỪNG gói kèm giá + chu kỳ.
     * MỘT truy vấn nuôi cả card "Phân bổ gói" lẫn thẻ KPI "Doanh thu định kỳ tháng", nên trang
     * không phải nạp toàn bộ subscription về rồi đếm trong Java.
     */
    @Query("""
            select p.id as planId, p.code as code, p.nameVi as nameVi, p.nameEn as nameEn,
                   p.price as price, p.billingIntervalMonths as billingIntervalMonths,
                   p.displayOrder as displayOrder, count(s) as userCount
            from Subscription s
            join s.plan p
            join s.user u
            where s.deletedAt is null and u.deletedAt is null and p.deletedAt is null
              and s.status = :status
            group by p.id, p.code, p.nameVi, p.nameEn, p.price, p.billingIntervalMonths, p.displayOrder
            order by p.displayOrder
            """)
    List<PlanSubscriptionProjection> aggregateByPlan(@Param("status") SubscriptionStatus status);

    /** Toàn bộ subscription kèm plan + user (fetch) — nguồn dòng cho admin per-plan/per-user. */
    @Query("""
            select s from Subscription s
            join fetch s.plan
            join fetch s.user u
            where s.deletedAt is null and u.deletedAt is null
            """)
    List<Subscription> findAllWithPlanAndUser();
}
