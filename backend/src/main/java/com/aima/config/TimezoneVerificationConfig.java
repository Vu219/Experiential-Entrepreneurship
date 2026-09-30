package com.aima.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.TimeZone;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class TimezoneVerificationConfig implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Value("${APP_TIMEZONE:UTC}")
    private String appTimezone;

    @Override
    public void run(String... args) {
        log.info("╔══════════════════════════════════════════════════════════╗");
        log.info("║              TIMEZONE VERIFICATION                     ║");
        log.info("╠══════════════════════════════════════════════════════════╣");
        log.info("║ JVM default timezone : {}",
                TimeZone.getDefault().getID());
        log.info("║ System property      : {}",
                System.getProperty("user.timezone", "(not set)"));
        log.info("║ ZoneId.systemDefault : {}",
                ZoneId.systemDefault());
        log.info("║ LocalDateTime.now()  : {}",
                LocalDateTime.now());
        log.info("║ Expected TZ          : Asia/Ho_Chi_Minh (UTC+7)");
        log.info("╚══════════════════════════════════════════════════════════╝");

        // Sanity check — warn loudly if something is wrong
        String tz = TimeZone.getDefault().getID();
        if (!"Asia/Ho_Chi_Minh".equals(tz) && !"Asia/Saigon".equals(tz)) {
            log.error("!!! TIMEZONE MISMATCH !!! Expected Asia/Ho_Chi_Minh but got: {}. "
                    + "All timestamps will be incorrect!", tz);
        }

        verifyTimezoneUnchanged();
    }

    /**
     * APP_TIMEZONE là HẰNG SỐ sau khi đã có dữ liệu: mọi cột timestamp (ai_usage.created_at,
     * bucket rollup…) lưu giờ ĐỊA PHƯƠNG theo nó và KHÔNG có cột nào ghi lại timezone tại thời
     * điểm ghi — đổi giá trị làm dữ liệu trước/sau lẫn vào nhau không tách được. Lần chạy đầu
     * lưu giá trị vào bảng {@code system_config}; các lần sau so sánh, lệch → log ERROR.
     * Muốn đổi thật sự = MIGRATION có kế hoạch (convert toàn bộ timestamp), không phải sửa .env.
     */
    private void verifyTimezoneUnchanged() {
        try {
            List<String> stored = jdbcTemplate.queryForList(
                    "SELECT config_value FROM system_config WHERE config_key = 'app.timezone'", String.class);
            if (stored.isEmpty()) {
                jdbcTemplate.update(
                        "INSERT INTO system_config (config_key, config_value) VALUES ('app.timezone', ?)",
                        appTimezone);
                log.info("[Timezone] Đã chốt APP_TIMEZONE = {} vào system_config (hằng số — không đổi sau khi có dữ liệu)",
                        appTimezone);
            } else if (!stored.get(0).equals(appTimezone)) {
                log.error("!!! APP_TIMEZONE ĐÃ BỊ ĐỔI: DB chốt '{}' nhưng cấu hình hiện tại là '{}'. "
                        + "Timestamp ghi từ giờ sẽ LẪN với dữ liệu cũ không tách được (không cột nào lưu "
                        + "timezone lúc ghi). Đổi timezone phải là MIGRATION có kế hoạch — trả lại giá trị "
                        + "cũ trong .env hoặc convert toàn bộ dữ liệu trước.", stored.get(0), appTimezone);
            }
        } catch (Exception e) {
            log.error("[Timezone] Không kiểm tra được guard APP_TIMEZONE: {}", e.getMessage());
        }
    }
}
