package com.aima.config;

import com.aima.entity.PlatformApiVersion;
import com.aima.enums.Platform;
import com.aima.enums.VersionStatus;
import com.aima.repository.PlatformApiVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Seed dữ liệu cho tính năng liên kết MXH (chạy sau {@code DataInitializer}):
 * <ul>
 *   <li>Tạo cấu hình version mặc định cho 3 nền tảng (FB v25.0, IG v25.0, Threads v1.0).</li>
 *   <li>Tạo partial unique index chống trùng kết nối (WHERE deleted_at IS NULL) — JPA không khai báo được.</li>
 *   <li>Backfill phòng thủ cho các cột mới của {@code platform_accounts} nếu có dữ liệu cũ.</li>
 * </ul>
 * Dùng cách này thay Flyway/Liquibase vì dự án đang dùng {@code ddl-auto: update} cho schema.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(3)
public class PlatformDataInitializer implements CommandLineRunner {

    PlatformApiVersionRepository versionRepository;
    JdbcTemplate jdbcTemplate;

    private static final Map<Platform, String> DEFAULT_VERSIONS = Map.of(
            Platform.FACEBOOK, "v25.0",
            Platform.INSTAGRAM, "v25.0",
            Platform.THREADS, "v1.0"
    );

    @Override
    public void run(String... args) {
        seedApiVersions();
        backfillPlatformAccounts();
        createPartialUniqueIndex();
    }

    private void seedApiVersions() {
        DEFAULT_VERSIONS.forEach((platform, version) -> {
            if (!versionRepository.existsByPlatform(platform)) {
                PlatformApiVersion entity = PlatformApiVersion.builder()
                        .platform(platform)
                        .currentVersion(version)
                        .latestVersion(version)
                        .status(VersionStatus.UP_TO_DATE)
                        .lastCheckedAt(LocalDateTime.now())
                        .build();
                versionRepository.save(entity);
                log.info("[PlatformInit] Seeded API version {} = {}", platform, version);
            }
        });
    }

    // Phòng thủ: nếu cột mới được thêm dưới dạng nullable và có dòng cũ, gán giá trị mặc định hợp lý.
    private void backfillPlatformAccounts() {
        try {
            jdbcTemplate.update("UPDATE platform_accounts SET api_version_used = 'v25.0' WHERE api_version_used IS NULL");
            jdbcTemplate.update("UPDATE platform_accounts SET account_type = 'USER' WHERE account_type IS NULL");
            jdbcTemplate.update("UPDATE platform_accounts SET token_type = 'USER_TOKEN' WHERE token_type IS NULL");
            jdbcTemplate.update("UPDATE platform_accounts SET platform_account_id = id::text WHERE platform_account_id IS NULL");
        } catch (Exception e) {
            log.warn("[PlatformInit] Backfill platform_accounts bỏ qua: {}", e.getMessage());
        }
    }

    private void createPartialUniqueIndex() {
        try {
            jdbcTemplate.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uk_platform_accounts_user_platform_account " +
                            "ON platform_accounts (user_id, platform_name, platform_account_id) " +
                            "WHERE deleted_at IS NULL");
            log.info("[PlatformInit] Partial unique index trên platform_accounts đã sẵn sàng.");
        } catch (Exception e) {
            log.warn("[PlatformInit] Tạo partial unique index bỏ qua: {}", e.getMessage());
        }
    }
}
