package com.aima.repository;

import com.aima.entity.Subscription;
import com.aima.enums.SubscriptionStatus;
import com.aima.repository.projection.PlanSubscriptionProjection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
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

    /**
     * Khoá dòng subscription của user ({@code SELECT … FOR UPDATE}) cho thao tác admin gia hạn /
     * đổi / thu hồi — hai lần bấm gần nhau không được cộng hạn hai lần trên cùng một mốc cũ.
     * Gọi TRƯỚC {@code getOrCreate} trong cùng transaction để entity nạp vào context là bản đã
     * khoá. Cố ý không join fetch plan: khoá chỉ nên chạm dòng {@code subscriptions}.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.user.id = :userId and s.deletedAt is null")
    Optional<Subscription> findForUpdateByUserId(@Param("userId") UUID userId);

    /**
     * Subscription kèm plan + user — {@code SubscriptionExpiryJob} phải đọc cả hai để hạ gói
     * và gửi thông báo, mà nó chạy ngoài request context nên không thể dựa vào lazy proxy.
     */
    @Query("""
            select s from Subscription s
            join fetch s.plan
            join fetch s.user
            where s.id = :id and s.deletedAt is null
            """)
    Optional<Subscription> findDetailById(@Param("id") UUID id);

    /**
     * Id các subscription có gói trả tiền ĐÃ HẾT HẠN — nguồn của {@code SubscriptionExpiryJob}.
     *
     * <p>{@code planExpiresAt is not null} là điều kiện BẮT BUỘC: null nghĩa là gói KHÔNG hết
     * hạn (Free, hoặc gói admin cấp vĩnh viễn), không phải "hết hạn từ lâu".</p>
     */
    @Query("""
            select s.id from Subscription s
            where s.deletedAt is null
              and s.planExpiresAt is not null and s.planExpiresAt <= :now
            order by s.planExpiresAt
            """)
    List<UUID> findExpiredPlanIds(@Param("now") LocalDateTime now);

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
