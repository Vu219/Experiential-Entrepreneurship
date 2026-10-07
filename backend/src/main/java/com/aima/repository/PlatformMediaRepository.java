package com.aima.repository;

import com.aima.entity.PlatformMedia;
import com.aima.enums.Platform;
import com.aima.repository.projection.DueMediaProjection;
import com.aima.repository.projection.MediaSyncStatsProjection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformMediaRepository extends JpaRepository<PlatformMedia, UUID> {

    Optional<PlatformMedia> findByPost_Id(UUID postId);

    Optional<PlatformMedia> findByPlatformAccount_IdAndPlatformMediaIdAndDeletedAtIsNull(UUID platformAccountId,
                                                                                         String platformMediaId);

    /**
     * Bài đang theo dõi thuộc các kết nối ĐÃ XOÁ MỀM của cùng user + cùng tài khoản nền tảng (ngắt kết nối rồi kết nối lại
     * tạo dòng platform_accounts mới) — để chuyển lịch sử sang kết nối mới.
     */
    @Query("select m from PlatformMedia m where m.deletedAt is null and m.platformAccount.deletedAt is not null "
            + "and m.platformAccount.user.id = :userId and m.platformAccount.platformName = :platform "
            + "and m.platformAccount.platformAccountId = :platformAccountId")
    List<PlatformMedia> findFromDeletedConnections(@Param("userId") UUID userId, @Param("platform") Platform platform,
                                                   @Param("platformAccountId") String platformAccountId);

    List<PlatformMedia> findByPlatformAccount_IdAndDeletedAtIsNull(UUID platformAccountId);

    /** Webhook: cùng một bài có thể được nhiều user AIMA theo dõi (cùng Trang kết nối ở nhiều tài khoản AIMA). */
    List<PlatformMedia> findByPlatformMediaIdAndDeletedAtIsNull(String platformMediaId);

    /** Đồng bộ cấp tài khoản: bài đã theo dõi trong danh sách bài vừa đọc từ nền tảng (để không tạo trùng). */
    List<PlatformMedia> findByPlatformAccount_IdAndPlatformMediaIdInAndDeletedAtIsNull(UUID platformAccountId,
                                                                                       Collection<String> platformMediaIds);

    /**
     * Bài đến hạn đồng bộ, xếp theo tài khoản để job gom một lượt gọi mỗi tài khoản. Bài đã đồng bộ ít nhất
     * một lần chỉ còn được quét trong cửa sổ {@code windowStart} (90 ngày sau khi đăng); bài CHƯA đồng bộ lần
     * nào luôn được quét một lần (đồng bộ lại bài cũ). Tài khoản không ACTIVE (token hỏng) bị bỏ qua.
     */
    @Query("select m.id as mediaId, m.platformAccount.id as accountId from PlatformMedia m "
            + "where m.deletedAt is null and m.syncStatus = com.aima.enums.MetricsSyncStatus.ACTIVE "
            + "and (m.nextSyncAt is null or m.nextSyncAt <= :now) "
            + "and (m.lastSyncedAt is null or m.publishedAt >= :windowStart) "
            + "and m.platformAccount.deletedAt is null "
            + "and m.platformAccount.connectionStatus = com.aima.enums.ConnectionStatus.ACTIVE "
            + "order by m.platformAccount.id")
    List<DueMediaProjection> findDue(@Param("now") Instant now, @Param("windowStart") Instant windowStart,
                                     Pageable pageable);

    @Query("select m from PlatformMedia m join fetch m.platformAccount where m.id in :ids")
    List<PlatformMedia> findWithAccountByIdIn(@Param("ids") Collection<UUID> ids);

    /** Bài AIMA chưa có snapshot nào nhưng có số liệu mốc cũ trong post_analytics → cần chép sang. */
    @Query("select m.id from PlatformMedia m where m.deletedAt is null and m.post is not null "
            + "and not exists (select s from PostMetricSnapshot s where s.platformMedia = m) "
            + "and exists (select a from PostAnalytics a where a.post = m.post and a.deletedAt is null)")
    List<UUID> findNeedingBackfill(Pageable pageable);

    /** Trạng thái đồng bộ theo tài khoản cho thanh trạng thái trang Phân tích. */
    @Query("select m.platformAccount.id as accountId, count(m) as trackedPosts, "
            + "sum(case when m.lastSyncedAt is null and m.syncStatus = com.aima.enums.MetricsSyncStatus.ACTIVE then 1 else 0 end) as pendingPosts, "
            + "sum(case when m.syncStatus = com.aima.enums.MetricsSyncStatus.STOPPED then 1 else 0 end) as stoppedPosts, "
            + "sum(case when m.consecutiveFailures > 0 and m.lastErrorCode like 'PERMISSION%' then 1 else 0 end) as permissionErrors, "
            + "max(m.lastSyncedAt) as lastSyncedAt "
            + "from PlatformMedia m where m.deletedAt is null and m.platformAccount.user.id = :userId "
            + "group by m.platformAccount.id")
    List<MediaSyncStatsProjection> findSyncStatsForUser(@Param("userId") UUID userId);

    /** Lần đồng bộ số liệu gần nhất của user — "phiên bản dữ liệu" trong khoá cache của trang Phân tích. */
    @Query("select max(m.lastSyncedAt) from PlatformMedia m where m.platformAccount.user.id = :userId")
    Instant findLatestSyncForUser(@Param("userId") UUID userId);

    /**
     * Nút "Làm mới": đưa bài của user về hạn ngay để lượt quét kế tiếp (≤ 5 phút) đồng bộ. Bỏ qua bài vừa đồng
     * bộ trong {@code minLastSync} (chống bấm liên tục) và bài đang lỗi (giữ nguyên backoff).
     */
    @Modifying
    @Query("update PlatformMedia m set m.nextSyncAt = :now "
            + "where m.deletedAt is null and m.syncStatus = com.aima.enums.MetricsSyncStatus.ACTIVE "
            + "and m.consecutiveFailures = 0 "
            + "and (m.lastSyncedAt is null or (m.lastSyncedAt < :minLastSync and m.publishedAt >= :windowStart)) "
            + "and m.platformAccount.id in (select a.id from PlatformAccount a where a.user.id = :userId and a.deletedAt is null)")
    int markDueNow(@Param("userId") UUID userId, @Param("now") Instant now,
                   @Param("minLastSync") Instant minLastSync, @Param("windowStart") Instant windowStart);

    /** Dev-seed: dữ liệu mẫu không có bài thật trên nền tảng → không bao giờ gọi Meta cho chúng. */
    @Modifying
    @Query("update PlatformMedia m set m.syncStatus = com.aima.enums.MetricsSyncStatus.STOPPED, m.lastErrorCode = 'DEV_SEED' "
            + "where m.platformAccount.id in :accountIds")
    int stopForAccounts(@Param("accountIds") Collection<UUID> accountIds);

    /** Dev-seed clear: xoá cứng media của tài khoản MẪU (snapshot/daily phải xoá trước). */
    @Modifying
    @Query("delete from PlatformMedia m where m.platformAccount.id in :accountIds")
    int deleteForAccounts(@Param("accountIds") Collection<UUID> accountIds);
}
