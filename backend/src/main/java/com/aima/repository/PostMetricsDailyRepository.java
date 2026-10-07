package com.aima.repository;

import com.aima.entity.PlatformMedia;
import com.aima.entity.PostMetricsDaily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface PostMetricsDailyRepository extends JpaRepository<PostMetricsDaily, UUID> {

    List<PostMetricsDaily> findByPlatformMedia_Id(UUID platformMediaId);

    /** Gộp bản ghi theo dõi trùng: số theo ngày của bản bị gộp bị xoá mềm (bản giữ lại tính lại từ snapshot đã gộp). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PostMetricsDaily d set d.deletedAt = :now where d.platformMedia = :media and d.deletedAt is null")
    int softDeleteForMedia(@Param("media") PlatformMedia media, @Param("now") LocalDateTime now);

    /** Dev-seed clear: chỉ dùng cho tài khoản MẪU. */
    @Modifying
    @Query("delete from PostMetricsDaily d where d.platformMedia.id in "
            + "(select m.id from PlatformMedia m where m.platformAccount.id in :accountIds)")
    int deleteForAccounts(@Param("accountIds") Collection<UUID> accountIds);
}
