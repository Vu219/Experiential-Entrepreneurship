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
import java.time.temporal.ChronoUnit;

/**
 * Rollup event log {@code ai_usage} → {@code usage_hourly} / {@code usage_daily}
 * (heatmap/biểu đồ admin đọc từ rollup, không query thẳng event). Idempotent: mỗi lượt
 * DELETE + INSERT...SELECT nguyên các bucket trong cửa sổ — chạy lại không double-count.
 * Hạ tầng dự án không có message queue → dùng Spring scheduler (cùng mẫu scheduler/ khác).
 * <p>
 * Timezone: cột created_at lưu GIỜ VN (APP_TIMEZONE) nên date_trunc trực tiếp cho bucket
 * giờ/ngày VN — xem quy ước trên {@code UsageHourly.hourBucket}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UsageRollupJob {

    /** SELECT gộp dùng chung cho hai bảng — chỉ khác biểu thức bucket. */
    static final String AGGREGATE_SELECT = """
            SELECT gen_random_uuid(), date_trunc('%s', u.created_at), u.user_id, u.task_code,
                   u.provider_code, u.model_code,
                   count(*),
                   count(*) FILTER (WHERE u.status IN ('ERROR', 'TIMEOUT')),
                   sum(u.total_tokens),
                   sum(coalesce(u.billable_units, u.total_tokens)),
                   sum(coalesce(u.credit_units, 0)),
                   sum(u.estimated_cost),
                   sum(u.latency_ms) FILTER (WHERE u.latency_ms IS NOT NULL),
                   count(u.latency_ms),
                   now(), now()
            FROM ai_usage u
            WHERE u.created_at >= ? AND u.created_at < ? AND u.deleted_at IS NULL
            GROUP BY 2, 3, 4, 5, 6""";

    static final String INSERT_COLUMNS = "(id, %s, user_id, task_code, provider_code, model_code, "
            + "requests, errors, total_tokens, billable_units, credit_units, cost_usd, "
            + "latency_sum_ms, latency_count, created_at, updated_at)";

    JdbcTemplate jdbcTemplate;

    /**
     * Mỗi 10 phút: dựng lại các bucket GIỜ trong cửa sổ 2 giờ gần nhất; bảng trống (lần đầu
     * triển khai) → backfill toàn bộ lịch sử event một lượt để Tổng quan/heatmap đọc đủ.
     */
    @Scheduled(fixedDelay = 10 * 60 * 1000, initialDelay = 2 * 60 * 1000)
    @Transactional
    public void rollupHourly() {
        try {
            LocalDateTime to = LocalDateTime.now().truncatedTo(ChronoUnit.HOURS).plusHours(1);
            LocalDateTime from = to.minusHours(2);
            Boolean empty = jdbcTemplate.queryForObject(
                    "SELECT NOT EXISTS (SELECT 1 FROM usage_hourly)", Boolean.class);
            if (Boolean.TRUE.equals(empty)) {
                LocalDateTime earliest = jdbcTemplate.queryForObject(
                        "SELECT date_trunc('hour', min(created_at)) FROM ai_usage WHERE deleted_at IS NULL",
                        LocalDateTime.class);
                if (earliest == null) {
                    return; // chưa có event nào
                }
                from = earliest;
            }
            jdbcTemplate.update("DELETE FROM usage_hourly WHERE hour_bucket >= ? AND hour_bucket < ?", from, to);
            int inserted = jdbcTemplate.update(
                    "INSERT INTO usage_hourly " + INSERT_COLUMNS.formatted("hour_bucket")
                            + " " + AGGREGATE_SELECT.formatted("hour"),
                    from, to);
            log.debug("[UsageRollup] Hourly [{} → {}): {} dòng", from, to, inserted);
        } catch (Exception e) {
            // Rollup hụt một lượt không mất dữ liệu (event thô còn nguyên, purge có guard) — chỉ log.
            log.error("[UsageRollup] Hourly thất bại: {}", e.getMessage());
        }
    }

    /**
     * 02:30 hằng ngày: dựng lại usage_daily từ ngày ĐÃ ROLL gần nhất (làm lại ngày đó — có thể
     * còn thiếu event cuối ngày) tới hôm nay; bảng trống → backfill từ event cũ nhất một lượt.
     */
    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void rollupDaily() {
        try {
            LocalDateTime maxRolled = jdbcTemplate.queryForObject(
                    "SELECT max(day_bucket) FROM usage_daily", LocalDateTime.class);
            LocalDateTime earliestEvent = jdbcTemplate.queryForObject(
                    "SELECT date_trunc('day', min(created_at)) FROM ai_usage WHERE deleted_at IS NULL",
                    LocalDateTime.class);
            if (maxRolled == null && earliestEvent == null) {
                return; // chưa có event nào
            }
            LocalDateTime from = maxRolled != null ? maxRolled : earliestEvent;
            LocalDateTime to = LocalDate.now().plusDays(1).atStartOfDay();
            jdbcTemplate.update("DELETE FROM usage_daily WHERE day_bucket >= ? AND day_bucket < ?", from, to);
            int inserted = jdbcTemplate.update(
                    "INSERT INTO usage_daily " + INSERT_COLUMNS.formatted("day_bucket")
                            + " " + AGGREGATE_SELECT.formatted("day"),
                    from, to);
            log.info("[UsageRollup] Daily [{} → {}): {} dòng", from, to, inserted);
        } catch (Exception e) {
            log.error("[UsageRollup] Daily thất bại: {}", e.getMessage());
        }
    }
}
