package com.aima.scheduler;

import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.enums.Platform;
import com.aima.exception.AppException;
import com.aima.mapper.PostAnalyticsMapper;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * FR-59/BR-09: thu thập số liệu bài đã đăng tại các mốc 24h / 48h / 7 ngày sau khi đăng.
 * Chạy mỗi giờ; mỗi bài-mốc chỉ thu một lần (query "chưa có bản ghi của mốc"). Cùng nhóm
 * scheduler gọi Meta trực tiếp như TokenValidationJob — không mở transaction quanh HTTP
 * (rule #24), lỗi từng bài chỉ log + bỏ qua, lần quét sau tự thử lại (rule #27).
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AnalyticsCollectionJob {

    static final List<Integer> MILESTONE_HOURS = List.of(24, 48, 168); // 7 ngày = 168h

    PostRepository postRepository;
    MetaApiClient metaApiClient;
    PostAnalyticsMapper postAnalyticsMapper;
    TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelay = 3_600_000) // mỗi giờ
    @SchedulerLock(name = "analytics-collection", lockAtMostFor = "PT50M", lockAtLeastFor = "PT1M")
    public void run() {
        Instant now = Instant.now();
        for (int milestone : MILESTONE_HOURS) {
            List<UUID> due = postRepository.findDueForAnalytics(milestone, now.minus(java.time.Duration.ofHours(milestone)));
            if (due.isEmpty()) {
                continue;
            }
            log.info("[AnalyticsCollection] Mốc {}h: {} bài cần thu thập", milestone, due.size());
            for (UUID postId : due) {
                collect(postId, milestone);
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

    private void collect(UUID postId, int milestone) {
        try {
            MetricsTarget target = transactionTemplate.execute(tx -> {
                Post post = postRepository.findForAnalytics(postId).orElseThrow();
                return new MetricsTarget(post.getPlatformName(), post.getPlatformPostId(),
                        post.getSchedule().getPlatformAccount().getAccessToken());
            });

            // HTTP ngoài transaction (rule #24) — token page/user lấy từ kết nối của lịch.
            MetaApiClient.MetaPostMetrics metrics =
                    metaApiClient.getPostMetrics(target.platform(), target.platformPostId(), target.accessToken());

            transactionTemplate.executeWithoutResult(tx -> saveSnapshot(postId, milestone, metrics));
            log.info("[AnalyticsCollection] Đã thu mốc {}h cho bài {} ({})", milestone, postId, target.platform());
        } catch (AppException e) {
            // Lỗi phía Meta (token, quyền, bài đã xoá...) — lần quét sau tự thử lại.
            log.warn("[AnalyticsCollection] Bỏ qua bài {} mốc {}h: {}", postId, milestone, e.getMessage());
        } catch (Exception e) {
            // Lỗi code (lazy proxy, NPE...) — log đủ stacktrace thay vì một dòng warn dễ bỏ sót.
            log.error("[AnalyticsCollection] Lỗi nội bộ khi thu bài {} mốc {}h", postId, milestone, e);
        }
    }

    private void saveSnapshot(UUID postId, int milestone, MetaApiClient.MetaPostMetrics metrics) {
        Post post = postRepository.findForAnalytics(postId).orElseThrow();
        PostAnalytics analytics = postAnalyticsMapper.toAnalytics(post, metrics, milestone, Instant.now());
        // Analytics là chiều riêng: không đổi trạng thái lịch/bài (bài PARTIALLY_POSTED/FAILED vẫn được thu).
        post.getPostAnalytics().add(analytics); // cascade lưu bản ghi analytics khi commit
    }
}
