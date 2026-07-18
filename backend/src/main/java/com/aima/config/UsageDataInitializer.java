package com.aima.config;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Index cho event log {@code ai_usage} (trang admin Token & hạn mức — nhật ký/cursor
 * pagination + chống double-count). Idempotent (IF NOT EXISTS), chạy raw SQL vì JPA
 * không khai báo được index DESC composite lẫn partial unique index.
 * Dùng cách này thay Flyway/Liquibase vì dự án đang dùng {@code ddl-auto: update}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(7)
public class UsageDataInitializer implements CommandLineRunner {

    JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            // Keyset/cursor pagination cho tab Nhật ký sử dụng (KHÔNG dùng OFFSET).
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ai_usage_created_id ON ai_usage (created_at DESC, id DESC)");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage (user_id, created_at DESC)");
            jdbcTemplate.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ai_usage_task_created ON ai_usage (task_code, created_at DESC)");
            // Chống double-count khi job được xử lý lại: chỉ áp cho row có idempotency_key (event SUCCESS).
            jdbcTemplate.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_usage_idempotency ON ai_usage (idempotency_key) "
                            + "WHERE idempotency_key IS NOT NULL");
            // Quy ước timezone của bucket rollup — ghi thẳng vào DB để ai đọc schema cũng thấy.
            jdbcTemplate.execute("COMMENT ON COLUMN usage_hourly.hour_bucket IS "
                    + "'date_trunc(hour, created_at) tren timestamp luu GIO VIET NAM "
                    + "(JDBC ghi LocalDateTime theo APP_TIMEZONE=Asia/Ho_Chi_Minh) — "
                    + "bucket 03:00 = 3h sang gio VN, khong phai UTC. "
                    + "APP_TIMEZONE la HANG SO sau khi co du lieu (khong cot nao luu timezone luc ghi) — "
                    + "doi = migration co ke hoach, guard o TimezoneVerificationConfig/system_config'");
            jdbcTemplate.execute("COMMENT ON COLUMN usage_daily.day_bucket IS "
                    + "'date_trunc(day, created_at) theo GIO VIET NAM — cung quy uoc voi usage_hourly.hour_bucket "
                    + "(APP_TIMEZONE la hang so, xem comment o do)'");
            jdbcTemplate.execute("COMMENT ON COLUMN ai_usage.created_at IS "
                    + "'Timestamp GIO VIET NAM (LocalDateTime theo APP_TIMEZONE) — APP_TIMEZONE la HANG SO "
                    + "sau khi co du lieu, doi = migration co ke hoach'");
            log.info("[UsageInit] Index ai_usage (cursor + idempotency) + comment bucket rollup đã sẵn sàng");
        } catch (Exception e) {
            // Không chặn app khởi động vì thiếu index — chỉ ảnh hưởng hiệu năng/chống trùng, log để xử lý tay.
            log.error("[UsageInit] Không tạo được index ai_usage: {}", e.getMessage());
        }
    }
}
