package com.aima.scheduler;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Retention event log {@code ai_usage}: SUCCESS giữ 90 ngày, ERROR/TIMEOUT giữ 180 ngày
 * (cần khi điều tra sự cố). HARD DELETE — ngoại lệ đã chốt của rule soft-delete (dữ liệu
 * thống kê thô, đã gộp vào rollup).
 * <p>
 * GUARD BẮT BUỘC: chỉ xoá event của những ngày ĐÃ CÓ row trong {@code usage_daily} —
 * rollup chết âm thầm thì event thô được giữ lại, không mất dữ liệu vĩnh viễn.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UsageRetentionJob {

    static final int SUCCESS_RETENTION_DAYS = 90;
    static final int ERROR_RETENTION_DAYS = 180;

    /** Điều kiện guard dùng chung: ngày của event đã được rollup sang usage_daily. */
    static final String ROLLED_UP_GUARD =
            " AND EXISTS (SELECT 1 FROM usage_daily d WHERE d.day_bucket = date_trunc('day', u.created_at))";

    JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purge() {
        try {
            LocalDateTime successCutoff = LocalDate.now().minusDays(SUCCESS_RETENTION_DAYS).atStartOfDay();
            LocalDateTime errorCutoff = LocalDate.now().minusDays(ERROR_RETENTION_DAYS).atStartOfDay();

            // Row cũ trước khi có cột status (null) = SUCCESS.
            int successPurged = jdbcTemplate.update(
                    "DELETE FROM ai_usage u WHERE u.created_at < ? AND (u.status = 'SUCCESS' OR u.status IS NULL)"
                            + ROLLED_UP_GUARD,
                    successCutoff);
            int errorPurged = jdbcTemplate.update(
                    "DELETE FROM ai_usage u WHERE u.created_at < ? AND u.status IN ('ERROR', 'TIMEOUT')"
                            + ROLLED_UP_GUARD,
                    errorCutoff);
            if (successPurged > 0 || errorPurged > 0) {
                log.info("[UsageRetention] Purge event thô: {} SUCCESS (>{}d), {} ERROR/TIMEOUT (>{}d)",
                        successPurged, SUCCESS_RETENTION_DAYS, errorPurged, ERROR_RETENTION_DAYS);
            }
        } catch (Exception e) {
            log.error("[UsageRetention] Purge thất bại: {}", e.getMessage());
        }
    }
}
