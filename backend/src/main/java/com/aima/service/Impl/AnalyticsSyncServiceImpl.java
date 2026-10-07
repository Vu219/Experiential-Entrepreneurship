package com.aima.service.Impl;

import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostMetricSnapshot;
import com.aima.entity.PostMetricsDaily;
import com.aima.enums.MediaOrigin;
import com.aima.enums.MetricSource;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.MetricsSyncStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformMediaStatus;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostAnalyticsRepository;
import com.aima.repository.PostMetricSnapshotRepository;
import com.aima.repository.PostMetricsDailyRepository;
import com.aima.repository.PostRepository;
import com.aima.repository.projection.DueMediaProjection;
import com.aima.service.AnalyticsSyncService;
import com.aima.service.PlatformMetricsProvider;
import com.aima.service.PlatformMetricsProvider.PostMetricsResult;
import com.aima.util.MetricDeltaDistributor;
import com.aima.util.PublishingTime;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Xem {@link AnalyticsSyncService}. Mỗi bài ghi trong MỘT transaction ngắn riêng (snapshot + số theo ngày +
 * mốc + lịch đồng bộ kế tiếp) — lỗi một bài không làm hỏng bài khác.
 *
 * <p>Lịch đồng bộ thưa dần theo tuổi bài (mục 3.2): &lt;24h mỗi 2h, &lt;3 ngày mỗi 6h, &lt;7 ngày mỗi 12h,
 * &lt;30 ngày mỗi ngày, còn lại mỗi tuần; quá {@link #SYNC_WINDOW} sau khi đăng thì thôi quét (bài chưa đồng bộ
 * lần nào vẫn được quét MỘT lần). Mốc 24/48/168h được ép một lượt ngay khi tới mốc.</p>
 *
 * <p>Lỗi (mục D.1): NOT_FOUND hai lần cách 24h → DELETED + STOPPED; UNSUPPORTED → STOPPED; PERMISSION /
 * TOKEN_INVALID → 24h; lỗi tạm → 1h·2^(n−1) tối đa 24h; {@value #MAX_CONSECUTIVE_FAILURES} lỗi liên tiếp →
 * STOPPED; RATE_LIMIT → chờ 1h, không tính lỗi, dừng cả lượt quét.</p>
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AnalyticsSyncServiceImpl implements AnalyticsSyncService {

    static final List<Integer> MILESTONE_HOURS = List.of(24, 48, 168); // 7 ngày = 168h
    /** Snapshot muộn hơn mốc quá khoảng này thì không dùng làm số liệu mốc (tránh gán số hôm nay cho mốc 24h). */
    static final Duration MILESTONE_TOLERANCE = Duration.ofHours(24);
    static final Duration SYNC_WINDOW = Duration.ofDays(90);
    static final Duration MANUAL_REFRESH_MIN_GAP = Duration.ofMinutes(15);

    // Tần suất thích ứng (giai đoạn 3).
    static final double HOT_ENGAGEMENT_PER_HOUR = 5;
    static final double MIN_VELOCITY_WINDOW_HOURS = 0.25;
    static final Duration MIN_INTERVAL = Duration.ofHours(1);
    static final Duration MAX_INTERVAL = Duration.ofDays(7);

    static final int MAX_CONSECUTIVE_FAILURES = 8;
    static final Duration RATE_LIMIT_PAUSE = Duration.ofHours(1);
    static final Duration NOT_FOUND_RECHECK = Duration.ofHours(24);
    static final Duration MAX_BACKOFF = Duration.ofHours(24);

    PostRepository postRepository;
    PlatformMediaRepository platformMediaRepository;
    PostMetricSnapshotRepository snapshotRepository;
    PostMetricsDailyRepository dailyRepository;
    PostAnalyticsRepository postAnalyticsRepository;
    PostAnalyticsMapper postAnalyticsMapper;
    TransactionTemplate transactionTemplate;
    List<PlatformMetricsProvider> providers;

    // ===== Chuẩn bị =====

    @Override
    public int prepare(int batchSize) {
        int processed = 0;
        for (UUID postId : postRepository.findPostedWithoutMedia(PageRequest.of(0, batchSize))) {
            processed += runSafely("tạo dòng theo dõi cho bài " + postId, () -> track(postId));
        }
        for (UUID mediaId : platformMediaRepository.findNeedingBackfill(PageRequest.of(0, batchSize))) {
            processed += runSafely("chép số liệu mốc cũ cho media " + mediaId, () -> backfill(mediaId));
        }
        return processed;
    }

    // Bài AIMA vừa đăng → dòng theo dõi. Nếu lượt quét danh sách bài của Trang đã kịp nhận bài này là "ngoài AIMA"
    // (EXTERNAL, cùng tài khoản + id nền tảng) thì nhận lại dòng đó — số liệu đã thu giữ nguyên, không tạo trùng.
    private void track(UUID postId) {
        Post post = postRepository.findForAnalytics(postId).orElseThrow();
        PlatformMedia external = platformMediaRepository.findByPlatformAccount_IdAndPlatformMediaIdAndDeletedAtIsNull(
                post.getSchedule().getPlatformAccount().getId(), post.getPlatformPostId()).orElse(null);
        if (external != null && external.getPost() == null) {
            external.setPost(post);
            external.setOrigin(MediaOrigin.AIMA);
            return;
        }
        platformMediaRepository.save(postAnalyticsMapper.toPlatformMedia(post));
    }

    // Mốc cũ (24/48/168h) → snapshot BACKFILL, rồi tính số theo ngày ngay để lịch sử không trống.
    private void backfill(UUID mediaId) {
        PlatformMedia media = platformMediaRepository.findById(mediaId).orElseThrow();
        for (PostAnalytics row : postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(media.getPost().getId())) {
            if (row.getCollectedAt() != null) {
                snapshotRepository.save(postAnalyticsMapper.toBackfillSnapshot(media, row));
            }
        }
        rebuildDaily(media);
    }

    // ===== Đến hạn =====

    @Override
    public Map<UUID, List<UUID>> findDue(Instant now, int limit) {
        return platformMediaRepository.findDue(now, now.minus(SYNC_WINDOW), PageRequest.of(0, limit)).stream()
                .collect(Collectors.groupingBy(DueMediaProjection::getAccountId, LinkedHashMap::new,
                        Collectors.mapping(DueMediaProjection::getMediaId, Collectors.toList())));
    }

    // ===== Đồng bộ một tài khoản =====

    /** Giá trị cần cho lời gọi nền tảng — chụp trong transaction, dùng ngoài (không giữ entity/proxy). */
    private record SyncTarget(Platform platform, String accessToken, Map<String, UUID> mediaByPlatformId) {
        @Override
        public String toString() { // không để token lọt vào log
            return "SyncTarget[" + platform + ", " + mediaByPlatformId.size() + " bài]";
        }
    }

    @Override
    public boolean syncAccount(UUID accountId, List<UUID> mediaIds) {
        SyncTarget target = transactionTemplate.execute(tx -> {
            List<PlatformMedia> medias = platformMediaRepository.findWithAccountByIdIn(mediaIds);
            if (medias.isEmpty()) {
                return null;
            }
            PlatformAccount account = medias.getFirst().getPlatformAccount();
            return new SyncTarget(account.getPlatformName(), account.getAccessToken(), medias.stream()
                    .collect(Collectors.toMap(PlatformMedia::getPlatformMediaId, PlatformMedia::getId)));
        });
        if (target == null) {
            return true;
        }

        PlatformMetricsProvider provider = providers.stream()
                .filter(p -> p.platform() == target.platform()).findFirst().orElse(null);
        if (provider == null) {
            target.mediaByPlatformId().values().forEach(id -> recordFailureSafely(id, MetricsErrorType.UNSUPPORTED, "NO_PROVIDER"));
            return true;
        }

        // HTTP ngoài transaction (rule #24).
        List<PostMetricsResult> results;
        try {
            results = provider.fetchPostMetrics(target.accessToken(), List.copyOf(target.mediaByPlatformId().keySet()));
        } catch (RuntimeException e) {
            log.error("[AnalyticsSync] Lỗi nội bộ khi thu số liệu tài khoản {}", accountId, e);
            target.mediaByPlatformId().values().forEach(id -> recordFailureSafely(id, MetricsErrorType.TEMPORARY, "INTERNAL"));
            return true;
        }

        boolean rateLimited = false;
        int synced = 0;
        for (PostMetricsResult result : results) {
            UUID mediaId = target.mediaByPlatformId().get(result.platformMediaId());
            if (mediaId == null) {
                continue;
            }
            if (result.error() == null) {
                Instant now = Instant.now();
                int saved = runSafely("lưu số liệu media " + mediaId, () -> ingest(mediaId, result.metrics(), now));
                if (saved == 0) {
                    recordFailureSafely(mediaId, MetricsErrorType.TEMPORARY, "INTERNAL"); // không quét lại mỗi 5 phút
                }
                synced += saved;
            } else {
                MetricsErrorType type = result.error().getErrorType();
                log.warn("[AnalyticsSync] Media {} ({}) lỗi {} ({}): {}", mediaId, result.platformMediaId(), type,
                        result.error().getResponseCode(), result.error().getMessage());
                recordFailureSafely(mediaId, type, result.error().getResponseCode());
                rateLimited |= type == MetricsErrorType.RATE_LIMIT;
            }
        }
        log.info("[AnalyticsSync] Tài khoản {} ({}): {}/{} bài đã cập nhật", accountId, target.platform(),
                synced, mediaIds.size());
        return !rateLimited;
    }

    private void ingest(UUID mediaId, PlatformMetricsProvider.PostMetrics metrics, Instant now) {
        PlatformMedia media = platformMediaRepository.findById(mediaId).orElseThrow();
        Double velocity = snapshotRepository.findFirstByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtDesc(mediaId)
                .map(previous -> engagementPerHour(previous, metrics, now)).orElse(null);
        PostMetricSnapshot snapshot = snapshotRepository.save(
                postAnalyticsMapper.toSnapshot(media, metrics, now, MetricSource.POLL));
        rebuildDaily(media);
        deriveMilestones(media, snapshot);

        media.setPlatformStatus(PlatformMediaStatus.ACTIVE);
        media.setConsecutiveFailures(0);
        media.setLastSyncedAt(now);
        media.setNextSyncAt(nextSyncAt(media.getPublishedAt(), now, velocity));
    }

    /**
     * Tốc độ tương tác (cảm xúc + bình luận + chia sẻ / giờ) giữa snapshot trước và lần thu này; null khi không so được
     * (thiếu số, hai lần quá sát nhau). Lượt xem không dùng vì Meta trả trễ 24–48h.
     */
    static Double engagementPerHour(PostMetricSnapshot previous, PlatformMetricsProvider.PostMetrics current, Instant now) {
        Long before = engagement(previous.getReactions(), previous.getComments(), previous.getShares());
        Long after = engagement(current.reactions(), current.comments(), current.shares());
        double hours = Duration.between(previous.getCollectedAt(), now).toMinutes() / 60.0;
        if (before == null || after == null || hours < MIN_VELOCITY_WINDOW_HOURS) {
            return null;
        }
        return Math.max(0, after - before) / hours;
    }

    private static Long engagement(Long reactions, Long comments, Long shares) {
        if (reactions == null && comments == null && shares == null) {
            return null;
        }
        return (reactions == null ? 0 : reactions) + (comments == null ? 0 : comments) + (shares == null ? 0 : shares);
    }

    /**
     * Tính lại TOÀN BỘ số theo ngày của bài từ chuỗi snapshot (hàm thuần → chạy lại bao nhiêu lần cũng ra cùng
     * kết quả). Upsert theo (bài, ngày); ngày không còn phát sinh thì về 0.
     */
    private void rebuildDaily(PlatformMedia media) {
        List<MetricDeltaDistributor.Point> points = snapshotRepository
                .findByPlatformMedia_IdAndDeletedAtIsNullOrderByCollectedAtAsc(media.getId()).stream()
                .map(s -> new MetricDeltaDistributor.Point(s.getCollectedAt(), s.getViews(), s.getReactions(),
                        s.getComments(), s.getShares(), s.getSaves()))
                .toList();
        SortedMap<LocalDate, MetricDeltaDistributor.DailyDelta> deltas =
                MetricDeltaDistributor.distribute(media.getPublishedAt(), points, PublishingTime.LEGACY_ZONE);

        Map<LocalDate, PostMetricsDaily> existing = new HashMap<>(dailyRepository.findByPlatformMedia_Id(media.getId())
                .stream().collect(Collectors.toMap(PostMetricsDaily::getMetricDate, Function.identity())));
        for (Map.Entry<LocalDate, MetricDeltaDistributor.DailyDelta> entry : deltas.entrySet()) {
            PostMetricsDaily row = existing.remove(entry.getKey());
            if (row == null) {
                row = postAnalyticsMapper.toDaily(media, entry.getKey());
            }
            MetricDeltaDistributor.DailyDelta d = entry.getValue();
            row.setViewsDelta(d.views());
            row.setReactionsDelta(d.reactions());
            row.setCommentsDelta(d.comments());
            row.setSharesDelta(d.shares());
            row.setSavesDelta(d.saves());
            row.setEstimated(d.estimated());
            dailyRepository.save(row);
        }
        for (PostMetricsDaily stale : existing.values()) {
            stale.setViewsDelta(0);
            stale.setReactionsDelta(0);
            stale.setCommentsDelta(0);
            stale.setSharesDelta(0);
            stale.setSavesDelta(0);
            stale.setEstimated(false);
        }
    }

    // Mốc 24/48/168h (FR-59/FR-62, optimizer) = snapshot đầu tiên rơi vào [mốc, mốc + 24h).
    private void deriveMilestones(PlatformMedia media, PostMetricSnapshot snapshot) {
        Post post = media.getPost();
        if (post == null || media.getPublishedAt() == null) {
            return;
        }
        Set<Integer> existing = postAnalyticsRepository.findByPost_IdAndDeletedAtIsNull(post.getId()).stream()
                .map(PostAnalytics::getMilestoneHours).collect(Collectors.toSet());
        for (int milestone : MILESTONE_HOURS) {
            Instant due = media.getPublishedAt().plus(Duration.ofHours(milestone));
            boolean inWindow = !snapshot.getCollectedAt().isBefore(due)
                    && snapshot.getCollectedAt().isBefore(due.plus(MILESTONE_TOLERANCE));
            if (inWindow && !existing.contains(milestone)) {
                postAnalyticsRepository.save(postAnalyticsMapper.toAnalytics(post, snapshot, milestone));
            }
        }
    }

    /** Lần đồng bộ kế tiếp: thưa dần theo tuổi bài, nhưng không bỏ lỡ mốc 24/48/168h sắp tới. */
    static Instant nextSyncAt(Instant publishedAt, Instant now) {
        return nextSyncAt(publishedAt, now, null);
    }

    /**
     * Như trên, cộng TẦN SUẤT THÍCH ỨNG (giai đoạn 3) theo {@code engagementPerHour} (null = không biết → lịch theo tuổi):
     * bài "nóng" (≥ {@value #HOT_ENGAGEMENT_PER_HOUR} tương tác/giờ) đồng bộ dày gấp đôi, không dưới 1 giờ; bài đã qua
     * 24 giờ mà không có tương tác mới thì giãn gấp đôi, tối đa 7 ngày. Mốc 24/48/168h vẫn luôn được ép.
     */
    static Instant nextSyncAt(Instant publishedAt, Instant now, Double engagementPerHour) {
        if (publishedAt == null) {
            return now.plus(Duration.ofDays(1));
        }
        Duration age = Duration.between(publishedAt, now);
        Duration interval = age.compareTo(Duration.ofHours(24)) < 0 ? Duration.ofHours(2)
                : age.compareTo(Duration.ofDays(3)) < 0 ? Duration.ofHours(6)
                : age.compareTo(Duration.ofDays(7)) < 0 ? Duration.ofHours(12)
                : age.compareTo(Duration.ofDays(30)) < 0 ? Duration.ofDays(1)
                : Duration.ofDays(7);
        if (engagementPerHour != null && engagementPerHour >= HOT_ENGAGEMENT_PER_HOUR) {
            interval = max(interval.dividedBy(2), MIN_INTERVAL);
        } else if (engagementPerHour != null && engagementPerHour == 0 && age.compareTo(Duration.ofHours(24)) >= 0) {
            interval = min(interval.multipliedBy(2), MAX_INTERVAL);
        }
        Instant next = now.plus(interval);
        for (int milestone : MILESTONE_HOURS) {
            Instant due = publishedAt.plus(Duration.ofHours(milestone));
            if (due.isAfter(now) && due.isBefore(next)) {
                next = due.plus(Duration.ofMinutes(1)); // ngay SAU mốc để snapshot rơi vào cửa sổ mốc
            }
        }
        return next;
    }

    private static Duration max(Duration a, Duration b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    private static Duration min(Duration a, Duration b) {
        return a.compareTo(b) <= 0 ? a : b;
    }

    // ===== Lỗi =====

    private void recordFailureSafely(UUID mediaId, MetricsErrorType type, String responseCode) {
        runSafely("ghi trạng thái lỗi media " + mediaId, () -> recordFailure(mediaId, type, responseCode, Instant.now()));
    }

    private void recordFailure(UUID mediaId, MetricsErrorType type, String responseCode, Instant now) {
        PlatformMedia media = platformMediaRepository.findById(mediaId).orElseThrow();
        media.setLastErrorCode(truncate(type + ":" + responseCode));
        media.setLastErrorAt(now);

        switch (type) {
            case RATE_LIMIT -> media.setNextSyncAt(now.plus(RATE_LIMIT_PAUSE)); // không tính là lỗi của bài
            case NOT_FOUND -> {
                // 100/33 cũng có thể là mất quyền → chỉ kết luận "đã xoá" khi gặp lại sau 24h.
                if (media.getPlatformStatus() == PlatformMediaStatus.UNAVAILABLE) {
                    media.setPlatformStatus(PlatformMediaStatus.DELETED);
                    stop(media, "bài không còn trên nền tảng");
                } else {
                    media.setPlatformStatus(PlatformMediaStatus.UNAVAILABLE);
                    media.setNextSyncAt(now.plus(NOT_FOUND_RECHECK));
                }
            }
            case UNSUPPORTED -> stop(media, "nền tảng chưa hỗ trợ thu số liệu");
            default -> {
                int failures = media.getConsecutiveFailures() + 1;
                media.setConsecutiveFailures(failures);
                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    stop(media, failures + " lần lỗi liên tiếp (" + type + ")");
                } else {
                    media.setNextSyncAt(now.plus(backoff(type, failures)));
                }
            }
        }
    }

    private void stop(PlatformMedia media, String reason) {
        media.setSyncStatus(MetricsSyncStatus.STOPPED);
        media.setNextSyncAt(null);
        log.warn("[AnalyticsSync] Ngừng thu số liệu media {} ({}): {}", media.getId(), media.getPlatformMediaId(), reason);
    }

    /** Thiếu quyền / token hỏng: chờ người dùng kết nối lại → thử mỗi 24h. Lỗi tạm: 1h, 2h, 4h... tối đa 24h. */
    static Duration backoff(MetricsErrorType type, int failures) {
        if (type == MetricsErrorType.PERMISSION || type == MetricsErrorType.TOKEN_INVALID) {
            return MAX_BACKOFF;
        }
        Duration delay = Duration.ofHours(1L << Math.min(failures - 1, 5));
        return delay.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : delay;
    }

    // ===== Webhook (giai đoạn 3) =====

    @Override
    public int syncSoon(String platformMediaId, Duration delay) {
        Instant target = Instant.now().plus(delay);
        int moved = 0;
        for (PlatformMedia media : platformMediaRepository.findByPlatformMediaIdAndDeletedAtIsNull(platformMediaId)) {
            if (media.getSyncStatus() != MetricsSyncStatus.ACTIVE) {
                continue;
            }
            if (media.getNextSyncAt() == null || media.getNextSyncAt().isAfter(target)) {
                media.setNextSyncAt(target);
                moved++;
            }
        }
        return moved;
    }

    @Override
    public int markDeleted(String platformMediaId) {
        int marked = 0;
        for (PlatformMedia media : platformMediaRepository.findByPlatformMediaIdAndDeletedAtIsNull(platformMediaId)) {
            if (media.getPlatformStatus() == PlatformMediaStatus.DELETED) {
                continue;
            }
            media.setPlatformStatus(PlatformMediaStatus.DELETED);
            stop(media, "nền tảng báo bài đã bị xoá (webhook)");
            marked++;
        }
        return marked;
    }

    // ===== Làm mới thủ công =====

    @Override
    public int requestSync(UUID userId) {
        Instant now = Instant.now();
        Integer queued = transactionTemplate.execute(tx -> platformMediaRepository.markDueNow(
                userId, now, now.minus(MANUAL_REFRESH_MIN_GAP), now.minus(SYNC_WINDOW)));
        return queued == null ? 0 : queued;
    }

    // ===== Tiện ích =====

    /** Một đơn vị việc trong transaction riêng; lỗi chỉ log (scheduler phải bền — rule #27). Trả 1 nếu xong. */
    private int runSafely(String what, Runnable work) {
        try {
            transactionTemplate.executeWithoutResult(tx -> work.run());
            return 1;
        } catch (Exception e) {
            log.error("[AnalyticsSync] Lỗi khi {}", what, e);
            return 0;
        }
    }

    private static String truncate(String value) {
        return value.length() <= 50 ? value : value.substring(0, 50);
    }
}
