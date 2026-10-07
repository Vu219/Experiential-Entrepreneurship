package com.aima.service.Impl;

import com.aima.entity.MetaWebhookEvent;
import com.aima.enums.WebhookEventStatus;
import com.aima.repository.MetaWebhookEventRepository;
import com.aima.service.AnalyticsAccountSyncService;
import com.aima.service.AnalyticsSyncService;
import com.aima.service.MetaWebhookEventWorker;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Xem {@link MetaWebhookEventWorker}. Quy tắc với webhook Page {@code feed}:
 * <ul>
 *   <li>Bài ({@code item} status/post/photo/video) {@code verb=remove} → trạng thái riêng "Đã xoá trên nền tảng"
 *       ({@code platform_media.platform_status = DELETED}), giữ số liệu cuối cùng đã thu, ngừng đồng bộ. KHÔNG đổi trạng thái
 *       bài AIMA và KHÔNG thông báo "bị nền tảng gỡ" — webhook không cho biết bài bị Meta gỡ hay người dùng tự xoá
 *       (quyết định 07/10, thay hành vi SEC-06 cũ của webhook).</li>
 *   <li>Bài {@code verb=add} → quét danh sách bài của Trang ngay (bài tự đăng hiện trong ≤ 5 phút).</li>
 *   <li>Bình luận / cảm xúc / chia sẻ / thích trên bài đang theo dõi → đồng bộ bài đó sau {@value #ENGAGEMENT_DELAY_MINUTES}
 *       phút (gom nhiều sự kiện liên tiếp vào một lần gọi Meta). Webhook không mang số đếm — số vẫn lấy qua API.</li>
 *   <li>Còn lại → IGNORED (vẫn lưu để soi lại).</li>
 * </ul>
 * Lỗi xử lý → thử lại tối đa {@value #MAX_ATTEMPTS} lần qua job quét lại, sau đó FAILED.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaWebhookEventWorkerImpl implements MetaWebhookEventWorker {

    static final String FEED_FIELD = "feed";
    static final Set<String> POST_ITEMS = Set.of("status", "post", "photo", "video");
    static final Set<String> ENGAGEMENT_ITEMS = Set.of("comment", "reaction", "share", "like");
    static final int ENGAGEMENT_DELAY_MINUTES = 5;
    static final Duration ENGAGEMENT_DELAY = Duration.ofMinutes(ENGAGEMENT_DELAY_MINUTES);
    static final int MAX_ATTEMPTS = 3;
    /** Sự kiện PENDING lâu hơn ngưỡng này coi như worker async đã không chạy (app dừng, hàng đợi đầy...). */
    static final Duration STALE_AFTER = Duration.ofMinutes(2);
    static final String LOG_MODULE = "webhook.meta";

    MetaWebhookEventRepository eventRepository;
    AnalyticsSyncService analyticsSyncService;
    AnalyticsAccountSyncService analyticsAccountSyncService;
    SystemLogService systemLogService;
    TransactionTemplate transactionTemplate;

    @Override
    @Async("metaWebhookExecutor")
    public void process(UUID eventId) {
        handle(eventId);
    }

    @Override
    public int processStale(int limit) {
        LocalDateTime before = LocalDateTime.now().minus(STALE_AFTER);
        int tried = 0;
        for (UUID id : eventRepository.findStalePending(before, PageRequest.of(0, limit))) {
            handle(id);
            tried++;
        }
        return tried;
    }

    private void handle(UUID eventId) {
        try {
            transactionTemplate.executeWithoutResult(tx -> {
                MetaWebhookEvent event = eventRepository.lockById(eventId).orElse(null);
                if (event == null || event.getStatus() != WebhookEventStatus.PENDING) {
                    return; // đã có worker khác xử lý
                }
                event.setAttempts(event.getAttempts() + 1);
                event.setStatus(apply(event));
                event.setProcessedAt(Instant.now());
                event.setLastError(null);
            });
        } catch (Exception e) {
            log.error("[Webhook] Lỗi xử lý sự kiện {}", eventId, e);
            recordFailure(eventId, e);
        }
    }

    WebhookEventStatus apply(MetaWebhookEvent event) {
        if (!FEED_FIELD.equals(event.getField())) {
            return WebhookEventStatus.IGNORED;
        }
        String item = lower(event.getItem());
        String verb = lower(event.getVerb());
        String postId = event.getPlatformPostId();

        if (POST_ITEMS.contains(item) && "remove".equals(verb) && postId != null) {
            return analyticsSyncService.markDeleted(postId) > 0 ? WebhookEventStatus.PROCESSED : WebhookEventStatus.IGNORED;
        }
        if (POST_ITEMS.contains(item) && "add".equals(verb) && event.getPageId() != null) {
            return analyticsAccountSyncService.markDueForPage(event.getPageId()) > 0
                    ? WebhookEventStatus.PROCESSED : WebhookEventStatus.IGNORED;
        }
        if (ENGAGEMENT_ITEMS.contains(item) && postId != null) {
            return analyticsSyncService.syncSoon(postId, ENGAGEMENT_DELAY) > 0
                    ? WebhookEventStatus.PROCESSED : WebhookEventStatus.IGNORED;
        }
        return WebhookEventStatus.IGNORED;
    }

    private void recordFailure(UUID eventId, Exception error) {
        try {
            transactionTemplate.executeWithoutResult(tx -> eventRepository.lockById(eventId).ifPresent(event -> {
                if (event.getStatus() != WebhookEventStatus.PENDING) {
                    return;
                }
                event.setAttempts(event.getAttempts() + 1);
                event.setLastError(truncate(error.getClass().getSimpleName() + ": " + error.getMessage()));
                if (event.getAttempts() >= MAX_ATTEMPTS) {
                    event.setStatus(WebhookEventStatus.FAILED);
                    systemLogService.warn(LOG_MODULE, "Sự kiện webhook " + eventId + " lỗi " + MAX_ATTEMPTS
                            + " lần — bỏ qua: " + event.getLastError());
                }
            }));
        } catch (Exception e) {
            log.error("[Webhook] Không ghi được lỗi của sự kiện {}", eventId, e);
        }
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static String truncate(String value) {
        return value.length() <= 500 ? value : value.substring(0, 500);
    }
}
