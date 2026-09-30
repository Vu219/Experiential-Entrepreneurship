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
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Seed dữ liệu cho tính năng liên kết MXH (chạy sau {@code DataInitializer}):
 * <ul>
 *   <li>Tạo cấu hình version mặc định cho 3 nền tảng (FB v25.0, IG v25.0, Threads v1.0).</li>
 * </ul>
 * Schema, backfill và partial unique index do Flyway quản lý.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(3)
public class PlatformDataInitializer implements CommandLineRunner {

    PlatformApiVersionRepository versionRepository;

    private static final Map<Platform, String> DEFAULT_VERSIONS = Map.of(
            Platform.FACEBOOK, "v25.0",
            Platform.INSTAGRAM, "v25.0",
            Platform.THREADS, "v1.0"
    );

    @Override
    public void run(String... args) {
        seedApiVersions();
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

}
