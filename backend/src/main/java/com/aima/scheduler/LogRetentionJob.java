package com.aima.scheduler;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Dọn dẹp mọi bảng dạng "vết" theo retention — gộp 3 loại vào MỘT job để chính sách giữ dữ liệu
 * nằm ở một chỗ, không rải rác mỗi bảng một scheduler:
 * <ul>
 *   <li>{@code activity_logs} — log hoạt động nghiệp vụ (mặc định 90 ngày)</li>
 *   <li>{@code system_logs} — log lỗi hệ thống (mặc định 180 ngày, cần lâu hơn để điều tra sự cố)</li>
 *   <li>{@code ai_usage} — event usage thô: SUCCESS 90 ngày, ERROR/TIMEOUT 180 ngày</li>
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

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purge() {
        purgeActivityLogs();
        purgeSystemLogs();
        purgeUsageEvents();
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

    private static LocalDateTime cutoff(int days) {
        return LocalDate.now().minusDays(days).atStartOfDay();
    }
}
