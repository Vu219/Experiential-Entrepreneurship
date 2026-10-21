package com.aima.config;

import com.aima.entity.PlatformApiVersion;
import com.aima.enums.Platform;
import com.aima.enums.VersionStatus;
import com.aima.repository.PlatformApiVersionRepository;
import com.aima.service.PlatformAvailabilityService;
import org.springframework.dao.DataIntegrityViolationException;
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
 *   <li>Trạng thái mở/khoá liên kết của 3 nền tảng (V20) — xem {@link #seedAvailability()}.</li>
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
    PlatformAvailabilityService platformAvailabilityService;

    private static final Map<Platform, String> DEFAULT_VERSIONS = Map.of(
            Platform.FACEBOOK, "v25.0",
            Platform.INSTAGRAM, "v25.0",
            Platform.THREADS, "v1.0"
    );

    @Override
    public void run(String... args) {
        seedApiVersions();
        seedAvailability();
    }

    /**
     * Trạng thái mở/khoá nền tảng (V20): lần đầu theo env AIMA_CONNECTION_ENABLED_PLATFORMS (mặc định chỉ FACEBOOK mở);
     * nền tảng vừa seed ở trạng thái khoá → giữ lịch chưa đăng của kết nối có từ trước MỘT lần. Đã có dòng → bỏ qua.
     * Hai instance khởi động cùng lúc: bên thua vi phạm unique → log và bỏ qua (bên thắng đã seed + giữ lịch).
     */
    private void seedAvailability() {
        try {
            int held = platformAvailabilityService.seedDefaults();
            if (held > 0) {
                log.info("[PlatformInit] Seed trạng thái nền tảng — {} lịch chưa đăng chuyển Tạm giữ (PLATFORM_DISABLED)", held);
            }
        } catch (DataIntegrityViolationException e) {
            log.info("[PlatformInit] Trạng thái nền tảng đã được instance khác seed — bỏ qua");
        }
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
