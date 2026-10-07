package com.aima.scheduler;

import com.aima.util.PublishingTime;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Dọn dẹp mọi bảng dạng "vết" theo retention — gộp 3 loại vào MỘT job để chính sách giữ dữ liệu
 * nằm ở một chỗ, không rải rác mỗi bảng một scheduler:
 * <ul>
 *   <li>{@code activity_logs} — log hoạt động nghiệp vụ (mặc định 90 ngày)</li>
 *   <li>{@code system_logs} — log lỗi hệ thống (mặc định 180 ngày, cần lâu hơn để điều tra sự cố)</li>
 *   <li>{@code ai_usage} — event usage thô: SUCCESS 90 ngày, ERROR/TIMEOUT 180 ngày</li>
 *   <li>{@code meta_webhook_events} — sự kiện webhook Meta đã xử lý / bỏ qua / lỗi (mặc định 30 ngày; PENDING không xoá)</li>
 *   <li>{@code post_metric_snapshots} — snapshot số liệu bài thô (mặc định 180 ngày, chốt Q7 của
 *       docs/analytics-real-data-plan.md); LUÔN giữ snapshot mới nhất của mỗi bài vì Top bài viết / heatmap /
 *       Hồ sơ đọc nó. Số theo ngày ({@code post_metrics_daily}) giữ vĩnh viễn, không đụng tới.</li>
 * </ul>
 *
 * <p>Toàn bộ số ngày đọc từ biến môi trường ({@code aima.retention.*}) — đổi chính sách không cần
 * build lại. Đặt 0 hoặc số âm để TẮT việc dọn bảng đó.
 *
 * <p><b>HARD DELETE</b> — ngoại lệ đã chốt của rule soft-delete (rule #9): đây là dữ liệu vết/thống kê
 * thô, không phải dữ liệu nghiệp vụ cần khôi phục.
 *
 * <p><b>GUARD của {@code ai_usage} (giữ nguyên từ UsageRetentionJob cũ):</b> chỉ xoá event của những
 * ngày ĐÃ CÓ row trong {@code usage_daily} — rollup chết âm thầm thì event thô được giữ lại, không
 * mất dữ liệu vĩnh viễn.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class LogRetentionJob {

    /** Điều kiện guard dùng chung: ngày của event đã được rollup sang usage_daily. */
    static final String ROLLED_UP_GUARD =
            " AND EXISTS (SELECT 1 FROM usage_daily d WHERE d.day_bucket = date_trunc('day', u.created_at))";

    JdbcTemplate jdbcTemplate;

    @NonFinal
    @Value("${aima.retention.activity-log-days:90}")
    int activityLogDays;

    @NonFinal
    @Value("${aima.retention.system-log-days:180}")
    int systemLogDays;

    @NonFinal
    @Value("${aima.retention.usage-success-days:90}")
    int usageSuccessDays;

    @NonFinal
    @Value("${aima.retention.usage-error-days:180}")
    int usageErrorDays;

    @NonFinal
    @Value("${aima.retention.metric-snapshot-days:180}")
    int metricSnapshotDays;

    @NonFinal
    @Value("${aima.retention.webhook-event-days:30}")
    int webhookEventDays;

    @Scheduled(cron = "0 30 3 * * *")
    @SchedulerLock(name = "log-retention", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    @Transactional
    public void purge() {
        purgeActivityLogs();
        purgeSystemLogs();
        purgeUsageEvents();
        purgeMetricSnapshots();
        purgeWebhookEvents();
    }

    private void purgeWebhookEvents() {
        if (webhookEventDays <= 0) {
            return;
        }
        try {
            int purged = jdbcTemplate.update(
                    "DELETE FROM meta_webhook_events WHERE created_at < ? AND status <> 'PENDING'", cutoff(webhookEventDays));
            if (purged > 0) {
                log.info("[LogRetention] Xoá {} sự kiện webhook Meta (>{}d)", purged, webhookEventDays);
            }
        } catch (Exception e) {
            log.error("[LogRetention] Dọn meta_webhook_events thất bại: {}", e.getMessage());
        }
    }

    private void purgeActivityLogs() {
        if (activityLogDays <= 0) {
            return;
        }
        try {
            int purged = jdbcTemplate.update("DELETE FROM activity_logs WHERE created_at < ?",
                    cutoff(activityLogDays));
            if (purged > 0) {
                log.info("[LogRetention] Xoá {} dòng activity_logs (>{}d)", purged, activityLogDays);
            }
        } catch (Exception e) {
            log.error("[LogRetention] Dọn activity_logs thất bại: {}", e.getMessage());
        }
    }

    private void purgeSystemLogs() {
        if (systemLogDays <= 0) {
            return;
        }
        try {
            int purged = jdbcTemplate.update("DELETE FROM system_logs WHERE created_at < ?",
                    cutoff(systemLogDays));
            if (purged > 0) {
                log.info("[LogRetention] Xoá {} dòng system_logs (>{}d)", purged, systemLogDays);
            }
        } catch (Exception e) {
            log.error("[LogRetention] Dọn system_logs thất bại: {}", e.getMessage());
        }
    }

    private void purgeUsageEvents() {
        try {
            int successPurged = 0;
            int errorPurged = 0;
            if (usageSuccessDays > 0) {
                // Row cũ trước khi có cột status (null) = SUCCESS.
                successPurged = jdbcTemplate.update(
                        "DELETE FROM ai_usage u WHERE u.created_at < ? AND (u.status = 'SUCCESS' OR u.status IS NULL)"
                                + ROLLED_UP_GUARD,
                        cutoff(usageSuccessDays));
            }
            if (usageErrorDays > 0) {
                errorPurged = jdbcTemplate.update(
                        "DELETE FROM ai_usage u WHERE u.created_at < ? AND u.status IN ('ERROR', 'TIMEOUT')"
                                + ROLLED_UP_GUARD,
                        cutoff(usageErrorDays));
            }
            if (successPurged > 0 || errorPurged > 0) {
                log.info("[LogRetention] Purge ai_usage: {} SUCCESS (>{}d), {} ERROR/TIMEOUT (>{}d)",
                        successPurged, usageSuccessDays, errorPurged, usageErrorDays);
            }
        } catch (Exception e) {
            log.error("[LogRetention] Dọn ai_usage thất bại: {}", e.getMessage());
        }
    }

    // Chỉ xoá snapshot có snapshot MỚI HƠN của cùng bài. Bài cũ quá 90 ngày đã thôi đồng bộ nên số theo ngày của
    // chúng không bị tính lại; nếu một bài như vậy được đồng bộ lại (vd. bài chưa từng đồng bộ), phần lịch sử đã dọn
    // được chia đều lại từ ngày đăng (is_estimated) — tổng không đổi.
    private void purgeMetricSnapshots() {
        if (metricSnapshotDays <= 0) {
            return;
        }
        try {
            int purged = jdbcTemplate.update(
                    "DELETE FROM post_metric_snapshots s WHERE s.collected_at < ? AND EXISTS ("
                            + "SELECT 1 FROM post_metric_snapshots n WHERE n.platform_media_id = s.platform_media_id "
                            + "AND n.collected_at > s.collected_at)",
                    Timestamp.from(cutoff(metricSnapshotDays).atZone(PublishingTime.LEGACY_ZONE).toInstant()));
            if (purged > 0) {
                log.info("[LogRetention] Xoá {} snapshot số liệu bài (>{}d, giữ bản mới nhất mỗi bài)",
                        purged, metricSnapshotDays);
            }
        } catch (Exception e) {
            log.error("[LogRetention] Dọn post_metric_snapshots thất bại: {}", e.getMessage());
        }
    }

    private static LocalDateTime cutoff(int days) {
        return LocalDate.now().minusDays(days).atStartOfDay();
    }
}
