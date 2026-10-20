package com.aima.repository;

import com.aima.enums.ResearchTrigger;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.ResearchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrendResearchSessionRepository extends JpaRepository<TrendResearchSession, UUID> {

    Optional<TrendResearchSession> findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    List<TrendResearchSession> findByBrandProfile_User_IdAndDeletedAtIsNullOrderByResearchTimeDesc(UUID userId);

    // FR-19: không cho phép 2 phiên nghiên cứu chạy song song cho cùng một user.
    boolean existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(UUID userId, Collection<ResearchStatus> statuses);

    // Phiên kẹt (server restart / worker chết / hàng đợi mất khi deploy) → FAILED, nếu không user bị chặn
    // "Research ngay" mãi (guard 1 phiên/user). RUNNING và PENDING thủ công kẹt sau :threshold; PENDING của
    // job 2:00 AM chờ trong hàng đợi dài nên dùng :scheduledThreshold. Bulk update không chạy
    // @UpdateTimestamp nên set tay updatedAt.
    @Modifying(flushAutomatically = true)
    @Query("update TrendResearchSession s set s.status = com.aima.enums.ResearchStatus.FAILED, "
            + "s.errorMessage = :message, s.updatedAt = :now "
            + "where s.deletedAt is null and ("
            + "(s.status = com.aima.enums.ResearchStatus.RUNNING and s.updatedAt < :threshold) "
            + "or (s.status = com.aima.enums.ResearchStatus.PENDING and s.triggerType = com.aima.enums.ResearchTrigger.MANUAL "
            + "and s.updatedAt < :threshold) "
            + "or (s.status = com.aima.enums.ResearchStatus.PENDING and s.triggerType = com.aima.enums.ResearchTrigger.SCHEDULED "
            + "and s.updatedAt < :scheduledThreshold))")
    int failStuckSessions(@Param("threshold") LocalDateTime threshold,
                          @Param("scheduledThreshold") LocalDateTime scheduledThreshold,
                          @Param("now") LocalDateTime now, @Param("message") String message);

    /** Phiên RUNNING / PENDING thủ công sắp bị {@link #failStuckSessions} chốt — để báo user (phiên tự động xếp hàng thì không). */
    @Query("select s.id from TrendResearchSession s where s.deletedAt is null and s.updatedAt < :threshold and ("
            + "s.status = com.aima.enums.ResearchStatus.RUNNING or (s.status = com.aima.enums.ResearchStatus.PENDING "
            + "and s.triggerType = com.aima.enums.ResearchTrigger.MANUAL))")
    List<UUID> findStuckActiveIds(@Param("threshold") LocalDateTime threshold);

    // User bấm "Research ngay" khi phiên tự động của họ còn xếp hàng (chưa chạy) → bỏ phiên tự động,
    // thay vì bắt user chờ cả lượt 2:00 AM. Worker thấy phiên không còn PENDING sẽ bỏ qua.
    @Modifying(flushAutomatically = true)
    @Query("update TrendResearchSession s set s.status = com.aima.enums.ResearchStatus.FAILED, "
            + "s.errorMessage = :message, s.updatedAt = :now "
            + "where s.status = com.aima.enums.ResearchStatus.PENDING "
            + "and s.triggerType = com.aima.enums.ResearchTrigger.SCHEDULED and s.deletedAt is null "
            + "and s.brandProfile.id in (select b.id from BrandProfile b where b.user.id = :userId)")
    int supersedeQueuedScheduled(@Param("userId") UUID userId, @Param("now") LocalDateTime now,
                                 @Param("message") String message);

    // Dispatch bị executor từ chối (hàng đợi đầy) — chốt FAILED ngay trong transaction riêng (gọi từ
    // afterCommit, nơi transaction cũ đã kết thúc).
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Modifying(flushAutomatically = true)
    @Query("update TrendResearchSession s set s.status = com.aima.enums.ResearchStatus.FAILED, "
            + "s.errorMessage = :message, s.updatedAt = :now "
            + "where s.id = :id and s.status = com.aima.enums.ResearchStatus.PENDING")
    int failPending(@Param("id") UUID id, @Param("now") LocalDateTime now, @Param("message") String message);

    /** Giới hạn gói TREND_RESEARCH_PER_PERIOD: phiên theo nguồn trong kỳ, phiên FAILED không tính (lỗi hệ thống). */
    @Query("select count(s) from TrendResearchSession s where s.brandProfile.user.id = :userId "
            + "and s.triggerType = :trigger and s.status <> com.aima.enums.ResearchStatus.FAILED "
            + "and s.createdAt >= :from and s.createdAt < :to and s.deletedAt is null")
    long countInPeriod(@Param("userId") UUID userId, @Param("trigger") ResearchTrigger trigger,
                       @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
