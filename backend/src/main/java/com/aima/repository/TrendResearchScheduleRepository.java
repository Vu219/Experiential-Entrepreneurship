package com.aima.repository;

import com.aima.entity.TrendResearchSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface TrendResearchScheduleRepository extends JpaRepository<TrendResearchSchedule, UUID> {

    Optional<TrendResearchSchedule> findByUser_IdAndDeletedAtIsNull(UUID userId);

    List<TrendResearchSchedule> findByEnabledTrueAndDeletedAtIsNull();

    /** User đã tự cấu hình lịch (bật hoặc tắt) — lượt mặc định 02:00 bỏ qua họ. */
    @Query("select s.user.id from TrendResearchSchedule s where s.deletedAt is null")
    Set<UUID> findUserIdsWithSchedule();
}
