package com.aima.scheduler;

import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.enums.MetricsErrorType;
import com.aima.enums.MetricsSyncStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformMediaStatus;
import com.aima.exception.MetricsFetchException;
import com.aima.mapper.PostAnalyticsMapper;
import com.aima.repository.PlatformMediaRepository;
import com.aima.repository.PostRepository;
import com.aima.service.MetaApiClient;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * FR-59/BR-09: thu thập số liệu bài đã đăng tại các mốc 24h / 48h / 7 ngày sau khi đăng.
 * Chạy mỗi giờ; mỗi bài-mốc chỉ thu một lần (query "chưa có bản ghi của mốc"). Cùng nhóm
 * scheduler gọi Meta trực tiếp như TokenValidationJob — không mở transaction quanh HTTP (rule #24).
 *
 * <p>Lỗi từng bài được phân loại ({@link MetricsErrorType}) và ghi vào {@link PlatformMedia} để KHÔNG gọi lại
 * vô hạn mỗi giờ (docs/analytics-real-data-plan.md, mục D.1): bài xoá trên nền tảng (2 lần NOT_FOUND cách 24h)
 * và nền tảng chưa hỗ trợ → dừng hẳn; thiếu quyền / token hỏng → thử lại sau 24h; lỗi tạm → backoff mũ;
 * quá {@value #MAX_CONSECUTIVE_FAILURES} lần lỗi liên tiếp → dừng. Rate limit → dừng cả lượt quét.
 * Analytics không đổi trạng thái bài/lịch (D2).</p>
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AnalyticsCollectionJob {

    static final List<Integer> MILESTONE_HOURS = List.of(24, 48, 168); // 7 ngày = 168h

    static final int MAX_CONSECUTIVE_FAILURES = 8;
    static final Duration RATE_LIMIT_PAUSE = Duration.ofHours(1);
    static final Duration NOT_FOUND_RECHECK = Duration.ofHours(24);
    static final Duration MAX_BACKOFF = Duration.ofHours(24);

    PostRepository postRepository;
    PlatformMediaRepository platformMediaRepository;
    MetaApiClient metaApiClient;
    PostAnalyticsMapper postAnalyticsMapper;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 3_600_000) // mỗi giờ
    @SchedulerLock(name = "analytics-collection", lockAtMostFor = "PT50M", lockAtLeastFor = "PT1M")
    public void run() {
        Instant now = Instant.now();
        for (int milestone : MILESTONE_HOURS) {
            List<UUID> due = postRepository.findDueForAnalytics(milestone, now.minus(Duration.ofHours(milestone)), now);
            if (due.isEmpty()) {
                continue;
            }
            log.info("[AnalyticsCollection] Mốc {}h: {} bài cần thu thập", milestone, due.size());
            for (UUID postId : due) {
                if (!collect(postId, milestone)) {
                    log.warn("[AnalyticsCollection] Bị Meta giới hạn tần suất — dừng lượt quét, thử lại lượt sau");
                    return;
                }
            }
        }
    }

    /** Giá trị cần cho lời gọi Meta — chụp trong transaction, dùng ngoài (không giữ entity/proxy). */
    private record MetricsTarget(Platform platform, String platformPostId, String accessToken) {
        @Override
        public String toString() { // không để token lọt vào log
            return "MetricsTarget[" + platform + ", " + platformPostId + "]";
        }
    }

    /** Thu một bài-mốc. Trả {@code false} khi bị rate limit — {@link #run()} dừng cả lượt quét. */
    boolean collect(UUID postId, int milestone) {
        MetricsErrorType errorType;
        String responseCode;
        try {
            MetricsTarget target = transactionTemplate.execute(tx -> {
                Post post = postRepository.findForAnalytics(postId).orElseThrow();
                return new MetricsTarget(post.getPlatformName(), post.getPlatformPostId(),
                        post.getSchedule().getPlatformAccount().getAccessToken());
            });

            // HTTP ngoài transaction (rule #24) — token page/user lấy từ kết nối của lịch.
            MetaApiClient.MetaPostMetrics metrics =
                    metaApiClient.getPostMetrics(target.platform(), target.platformPostId(), target.accessToken());

            transactionTemplate.executeWithoutResult(tx -> saveSnapshot(postId, milestone, metrics, Instant.now()));
            log.info("[AnalyticsCollection] Đã thu mốc {}h cho bài {} ({})", milestone, postId, target.platform());
            return true;
        } catch (MetricsFetchException e) {
            errorType = e.getErrorType();
            responseCode = e.getResponseCode();
            log.warn("[AnalyticsCollection] Bài {} mốc {}h lỗi {} ({}): {}",
                    postId, milestone, errorType, responseCode, e.getMessage());
        } catch (Exception e) {
            // Lỗi code (lazy proxy, NPE...) — log đủ stacktrace; vẫn tính là lỗi tạm để không quét lại vô hạn.
            log.error("[AnalyticsCollection] Lỗi nội bộ khi thu bài {} mốc {}h", postId, milestone, e);
            errorType = MetricsErrorType.TEMPORARY;
            responseCode = "INTERNAL";
        }

        MetricsErrorType type = errorType;
        String code = responseCode;
        try {
            transactionTemplate.executeWithoutResult(tx -> recordFailure(postId, type, code, Instant.now()));
        } catch (Exception e) {
            log.error("[AnalyticsCollection] Không ghi được trạng thái lỗi cho bài {}", postId, e);
        }
        return type != MetricsErrorType.RATE_LIMIT;
    }

    private void saveSnapshot(UUID postId, int milestone, MetaApiClient.MetaPostMetrics metrics, Instant now) {
        Post post = postRepository.findForAnalytics(postId).orElseThrow();
        PostAnalytics analytics = postAnalyticsMapper.toAnalytics(post, metrics, milestone, now);
        // Analytics là chiều riêng: không đổi trạng thái lịch/bài (bài PARTIALLY_POSTED/FAILED vẫn được thu).
        post.getPostAnalytics().add(analytics); // cascade lưu bản ghi analytics khi commit

        PlatformMedia media = mediaFor(post);
        media.setPlatformStatus(PlatformMediaStatus.ACTIVE);
        media.setConsecutiveFailures(0);
        media.setNextSyncAt(null);
        media.setLastSyncedAt(now);
    }

    private void recordFailure(UUID postId, MetricsErrorType type, String responseCode, Instant now) {
        Post post = postRepository.findForAnalytics(postId).orElseThrow();
        PlatformMedia media = mediaFor(post);
        media.setLastErrorCode(truncate(type + ":" + responseCode));
        media.setLastErrorAt(now);

        switch (type) {
            case RATE_LIMIT -> media.setNextSyncAt(now.plus(RATE_LIMIT_PAUSE)); // không tính là lỗi của bài
            case NOT_FOUND -> {
                // 100/33 cũng có thể là mất quyền → chỉ kết luận "đã xoá" khi gặp lại sau 24h.
                if (media.getPlatformStatus() == PlatformMediaStatus.UNAVAILABLE) {
                    media.setPlatformStatus(PlatformMediaStatus.DELETED);
                    stop(media, postId, "bài không còn trên nền tảng");
                } else {
                    media.setPlatformStatus(PlatformMediaStatus.UNAVAILABLE);
                    media.setNextSyncAt(now.plus(NOT_FOUND_RECHECK));
                }
            }
            case UNSUPPORTED -> stop(media, postId, "nền tảng chưa hỗ trợ thu số liệu");
            default -> {
                int failures = media.getConsecutiveFailures() + 1;
                media.setConsecutiveFailures(failures);
                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    stop(media, postId, failures + " lần lỗi liên tiếp (" + type + ")");
                } else {
                    media.setNextSyncAt(now.plus(backoff(type, failures)));
                }
            }
        }
    }

    private void stop(PlatformMedia media, UUID postId, String reason) {
        media.setSyncStatus(MetricsSyncStatus.STOPPED);
        media.setNextSyncAt(null);
        log.warn("[AnalyticsCollection] Ngừng thu số liệu bài {}: {}", postId, reason);
    }

    /** Thiếu quyền / token hỏng: chờ người dùng kết nối lại → thử mỗi 24h. Lỗi tạm: 1h, 2h, 4h... tối đa 24h. */
    static Duration backoff(MetricsErrorType type, int failures) {
        if (type == MetricsErrorType.PERMISSION || type == MetricsErrorType.TOKEN_INVALID) {
            return MAX_BACKOFF;
        }
        long hours = 1L << Math.min(failures - 1, 5);
        Duration delay = Duration.ofHours(hours);
        return delay.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : delay;
    }

    // Bài AIMA đăng sau V6 chưa có dòng platform_media → tạo khi thu lần đầu (thành công hay lỗi).
    private PlatformMedia mediaFor(Post post) {
        return platformMediaRepository.findByPost_Id(post.getId())
                .orElseGet(() -> platformMediaRepository.save(postAnalyticsMapper.toPlatformMedia(post)));
    }

    private static String truncate(String value) {
        return value.length() <= 50 ? value : value.substring(0, 50);
    }
}
