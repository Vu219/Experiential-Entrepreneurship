package com.aima.repository;

import com.aima.entity.PlatformMedia;
import com.aima.entity.PostMetricSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PostMetricSnapshotRepository extends JpaRepository<PostMetricSnapshot, UUID> {

    List<PostMetricSnapshot> findByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtAsc(UUID platformMediaId);

    /** Snapshot gần nhất của bài — để tính tốc độ tương tác cho lịch đồng bộ thích ứng. */
    Optional<PostMetricSnapshot> findFirstByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtDesc(UUID platformMediaId);

    /** Gộp bản ghi theo dõi trùng: chuyển chuỗi snapshot của bản bị gộp sang bản giữ lại. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PostMetricSnapshot s set s.platformMedia = :keeper where s.platformMedia = :merged")
    int moveToMedia(@Param("merged") PlatformMedia merged, @Param("keeper") PlatformMedia keeper);

    /** Dev-seed clear: chỉ dùng cho tài khoản MẪU. */
    @Modifying
    @Query("delete from PostMetricSnapshot s where s.platformMedia.id in "
            + "(select m.id from PlatformMedia m where m.platformAccount.id in :accountIds)")
    int deleteForAccounts(@Param("accountIds") Collection<UUID> accountIds);
}
