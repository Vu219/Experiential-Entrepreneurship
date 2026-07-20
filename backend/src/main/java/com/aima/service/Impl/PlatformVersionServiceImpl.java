package com.aima.service.Impl;

import com.aima.dto.request.UpdateVersionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ApiVersionHistoryResponse;
import com.aima.dto.response.ApiVersionResponse;
import com.aima.entity.PlatformApiVersion;
import com.aima.entity.PlatformApiVersionHistory;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.Platform;
import com.aima.enums.VersionChangeType;
import com.aima.enums.VersionStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformApiVersionMapper;
import com.aima.repository.PlatformApiVersionHistoryRepository;
import com.aima.repository.PlatformApiVersionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.PlatformVersionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class PlatformVersionServiceImpl implements PlatformVersionService {

    ActivityLogService activityLogService;

    PlatformApiVersionRepository versionRepository;
    PlatformApiVersionHistoryRepository historyRepository;
    UserRepository userRepository;
    PlatformApiVersionMapper versionMapper;

    // Cache version thủ công 5 phút (dự án chưa có cache manager). Evict tường minh khi admin update.
    static final Duration CACHE_TTL = Duration.ofMinutes(5);
    final ConcurrentHashMap<Platform, CachedVersion> versionCache = new ConcurrentHashMap<>();

    private record CachedVersion(String version, LocalDateTime cachedAt) {
        boolean isFresh() {
            return Duration.between(cachedAt, LocalDateTime.now()).compareTo(CACHE_TTL) < 0;
        }
    }

    private static final Pattern VERSION_PATTERN = Pattern.compile("v(\\d+)\\.(\\d+)");

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<ApiVersionResponse>> getAllVersions() {
        List<PlatformApiVersion> versions = versionRepository.findAll();
        List<ApiVersionResponse> responses = versionMapper.toResponseList(versions);
        return ApiResponse.success("Lấy danh sách version API thành công", responses);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<ApiVersionHistoryResponse>> getVersionHistory(Platform platform) {
        List<PlatformApiVersionHistory> history =
                historyRepository.findByPlatformApiVersion_PlatformOrderByCreatedAtDesc(platform);
        List<ApiVersionHistoryResponse> responses = versionMapper.toHistoryResponseList(history);
        return ApiResponse.success("Lấy lịch sử version thành công", responses);
    }

    @Override
    public ApiResponse<ApiVersionResponse> updateVersion(Platform platform, UpdateVersionRequest request, String adminEmail) {
        PlatformApiVersion version = versionRepository.findByPlatform(platform)
                .orElseThrow(() -> new AppException(ErrorCode.VERSION_NOT_FOUND));

        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        String fromVersion = version.getCurrentVersion();
        String toVersion = request.getNewVersion();

        VersionChangeType changeType = isNewer(toVersion, fromVersion)
                ? VersionChangeType.MANUAL_UPDATE
                : VersionChangeType.ROLLBACK;

        PlatformApiVersionHistory record = PlatformApiVersionHistory.builder()
                .platformApiVersion(version)
                .fromVersion(fromVersion)
                .toVersion(toVersion)
                .changeType(changeType)
                .notes(request.getNotes())
                .changedBy(admin)
                .build();
        historyRepository.save(record);

        version.setCurrentVersion(toVersion);
        version.setUpdatedBy(admin);
        version.setStatus(resolveStatus(toVersion, version.getLatestVersion(), version.getCurrentVersionDeprecationDate()));
        PlatformApiVersion saved = versionRepository.save(version);

        // Áp dụng tức thì cho mọi lời gọi Meta API sau đó.
        evictCache(platform);

        log.info("[ApiVersion] {} đổi {} -> {} bởi {}", platform, fromVersion, toVersion, adminEmail);
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.API_VERSION_UPDATED, adminEmail, "PlatformApiVersion", platform.name(),
                Map.of("from", String.valueOf(fromVersion), "to", String.valueOf(toVersion),
                        "changeType", changeType.name())));
        ApiVersionResponse response = versionMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật version thành công", response);
    }

    @Override
    public ApiResponse<List<ApiVersionResponse>> checkVersionsManually() {
        runVersionCheck();
        return getAllVersions();
    }

    @Override
    @Transactional(readOnly = true)
    public String getCurrentVersion(Platform platform) {
        CachedVersion cached = versionCache.get(platform);
        if (cached != null && cached.isFresh()) {
            return cached.version();
        }
        String version = versionRepository.findByPlatform(platform)
                .map(PlatformApiVersion::getCurrentVersion)
                .orElseThrow(() -> new AppException(ErrorCode.VERSION_NOT_FOUND));
        versionCache.put(platform, new CachedVersion(version, LocalDateTime.now()));
        return version;
    }

    @Override
    public void runVersionCheck() {
        for (PlatformApiVersion version : versionRepository.findAll()) {
            try {
                String latest = fetchLatestVersion(version.getPlatform());
                if (latest != null) {
                    version.setLatestVersion(latest);
                }
                version.setLastCheckedAt(LocalDateTime.now());
                version.setStatus(resolveStatus(version.getCurrentVersion(), version.getLatestVersion(),
                        version.getCurrentVersionDeprecationDate()));
                versionRepository.save(version);
                log.info("[ApiVersionCheck] {}: current={} latest={} status={}",
                        version.getPlatform(), version.getCurrentVersion(), version.getLatestVersion(), version.getStatus());
            } catch (Exception e) {
                log.warn("[ApiVersionCheck] Bỏ qua {} do lỗi: {}", version.getPlatform(), e.getMessage());
            }
        }
    }

    // Lấy version mới nhất từ trang changelog của Meta (chỉ Facebook/Instagram dùng Graph changelog).
    private String fetchLatestVersion(Platform platform) {
        if (platform == Platform.THREADS) {
            return null; // Threads chưa có trang changelog version công khai để parse.
        }
        try {
            Document doc = Jsoup
                    .connect("https://developers.facebook.com/docs/graph-api/changelog/versions/")
                    .userAgent("Mozilla/5.0 (AIMA version checker)")
                    .timeout(10_000)
                    .get();
            String highest = null;
            Matcher matcher = VERSION_PATTERN.matcher(doc.text());
            while (matcher.find()) {
                String candidate = matcher.group();
                if (highest == null || isNewer(candidate, highest)) {
                    highest = candidate;
                }
            }
            return highest;
        } catch (Exception e) {
            log.warn("[ApiVersionCheck] Không lấy được changelog Meta: {}", e.getMessage());
            return null;
        }
    }

    private VersionStatus resolveStatus(String current, String latest, LocalDateTime deprecationDate) {
        if (deprecationDate != null) {
            LocalDateTime now = LocalDateTime.now();
            if (deprecationDate.isBefore(now)) {
                return VersionStatus.DEPRECATED;
            }
            if (deprecationDate.isBefore(now.plusDays(60))) {
                return VersionStatus.DEPRECATING_SOON;
            }
        }
        if (latest != null && isNewer(latest, current)) {
            return VersionStatus.UPDATE_AVAILABLE;
        }
        return VersionStatus.UP_TO_DATE;
    }

    // So sánh "vMAJOR.MINOR": a có mới hơn b không.
    private boolean isNewer(String a, String b) {
        if (Objects.equals(a, b)) return false;
        int[] va = parse(a);
        int[] vb = parse(b);
        if (va == null || vb == null) return false;
        if (va[0] != vb[0]) return va[0] > vb[0];
        return va[1] > vb[1];
    }

    private int[] parse(String version) {
        if (version == null) return null;
        Matcher m = VERSION_PATTERN.matcher(version);
        if (m.find()) {
            return new int[]{Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2))};
        }
        return null;
    }

    private void evictCache(Platform platform) {
        versionCache.remove(platform);
    }
}
