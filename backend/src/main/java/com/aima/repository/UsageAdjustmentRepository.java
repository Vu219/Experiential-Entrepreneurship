package com.aima.repository;

import org.springframework.data.jpa.repository.Modifying;
import com.aima.entity.UsageAdjustment;
import com.aima.enums.UsageAdjustmentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface UsageAdjustmentRepository extends JpaRepository<UsageAdjustment, UUID> {

    /** Các điều chỉnh một loại của user trong cửa sổ thời gian, mới nhất trước (lấy mốc RESET gần nhất). */
    @Query("""
            select a from UsageAdjustment a
            where a.user.id = :userId and a.type = :type
              and a.createdAt >= :from and a.createdAt < :to and a.deletedAt is null
            order by a.createdAt desc
            """)
    List<UsageAdjustment> findByUserAndTypeInWindow(@Param("userId") UUID userId,
                                                    @Param("type") UsageAdjustmentType type,
                                                    @Param("from") LocalDateTime from,
                                                    @Param("to") LocalDateTime to);

    /** Tổng token đã cấp (GRANT) cho user trong cửa sổ thời gian. */
    @Query("""
            select coalesce(sum(a.deltaTokens), 0)
            from UsageAdjustment a
            where a.user.id = :userId and a.type = com.aima.enums.UsageAdjustmentType.GRANT
              and a.createdAt >= :from and a.createdAt < :to and a.deletedAt is null
            """)
    long sumGrantedForUser(@Param("userId") UUID userId,
                           @Param("from") LocalDateTime from,
                           @Param("to") LocalDateTime to);

    /** Tổng token đã cấp (GRANT) theo TỪNG user trong cửa sổ thời gian (admin list). */
    @Query("""
            select a.user.id as userId, sum(a.deltaTokens) as granted
            from UsageAdjustment a
            where a.type = com.aima.enums.UsageAdjustmentType.GRANT
              and a.createdAt >= :from and a.createdAt < :to and a.deletedAt is null
            group by a.user.id
            """)
    List<UserGrantAgg> aggregateGrantsByUser(@Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);

    /** User có mốc RESET trong cửa sổ — số ít, admin list tính lại riêng từng người. */
    @Query("""
            select distinct a.user.id from UsageAdjustment a
            where a.type = com.aima.enums.UsageAdjustmentType.RESET
              and a.createdAt >= :from and a.createdAt < :to and a.deletedAt is null
            """)
    List<UUID> findUserIdsWithReset(@Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to);

    /** Mọi điều chỉnh của user trong cửa sổ, mới nhất trước (lịch sử/audit ở modal chi tiết). */
    @Query("""
            select a from UsageAdjustment a
            where a.user.id = :userId
              and a.createdAt >= :from and a.createdAt < :to and a.deletedAt is null
            order by a.createdAt desc
            """)
    List<UsageAdjustment> findAllByUserInWindow(@Param("userId") UUID userId,
                                                @Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to);

    /** Audit cấp/reset TOÀN THỜI GIAN (tab Audit trang chi tiết user), mới nhất trước. */
    List<UsageAdjustment> findByUser_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    /** R8 — hoạt động cấp/reset theo TỪNG ADMIN từ mốc {@code from} (giám sát người giữ nút GRANT). */
    @Query("""
            select a.actor.id as actorId, a.actor.email as actorEmail,
                   sum(case when a.type = com.aima.enums.UsageAdjustmentType.GRANT
                            then coalesce(a.deltaTokens, 0) else 0 end) as grantedTokens,
                   sum(case when a.type = com.aima.enums.UsageAdjustmentType.GRANT then 1 else 0 end) as grantCount,
                   sum(case when a.type = com.aima.enums.UsageAdjustmentType.RESET then 1 else 0 end) as resetCount
            from UsageAdjustment a
            where a.actor is not null and a.createdAt >= :from and a.deletedAt is null
            group by a.actor.id, a.actor.email
            """)
    List<ActorActivityAgg> actorActivitySince(@Param("from") LocalDateTime from);

    interface ActorActivityAgg {
        UUID getActorId();

        String getActorEmail();

        Long getGrantedTokens();

        Long getGrantCount();

        Long getResetCount();
    }

    interface UserGrantAgg {
        UUID getUserId();

        Long getGranted();
    }

    // Xoá cứng tài khoản (admin): điều chỉnh của user KHÁC vẫn giữ, bỏ FK tới admin thao tác.
    @Modifying(flushAutomatically = true)
    @Query("update UsageAdjustment a set a.actor = null where a.actor.id = :userId")
    int clearActor(@Param("userId") UUID userId);
}
