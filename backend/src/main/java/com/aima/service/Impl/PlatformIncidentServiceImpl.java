package com.aima.service.Impl;

import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.mapper.AdminMonitorMapper;
import com.aima.repository.PostingJobRepository;
import com.aima.service.PlatformIncidentService;
import com.aima.util.SqlTemporalUtil;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Ngưỡng cấu hình qua {@code aima.publishing.outage.*}; cache thủ công {@code cache-seconds} (mẫu
 * {@code PlatformVersionServiceImpl}) vì dispatcher/worker hỏi cho từng retry / từng lần lỗi.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class PlatformIncidentServiceImpl implements PlatformIncidentService {

    /** Lỗi tạm thời phía nền tảng/mạng — tín hiệu của sự cố diện rộng (rate limit của riêng app thì không). */
    static final Set<PublishErrorCode> OUTAGE_SIGNALS = EnumSet.of(PublishErrorCode.PLATFORM_TEMPORARY,
            PublishErrorCode.NETWORK_TIMEOUT, PublishErrorCode.PLATFORM_OUTAGE);

    PostingJobRepository jobRepository;
    AdminMonitorMapper adminMonitorMapper;

    @NonFinal
    @Value("${aima.publishing.outage.window-minutes:15}")
    int windowMinutes;

    @NonFinal
    @Value("${aima.publishing.outage.min-failures:5}")
    int minFailures;

    @NonFinal
    @Value("${aima.publishing.outage.min-accounts:3}")
    int minAccounts;

    @NonFinal
    @Value("${aima.publishing.outage.cache-seconds:60}")
    int cacheSeconds;

    @NonFinal
    volatile Cached cached;

    private record Cached(List<PlatformIncidentResponse> incidents, Instant at) {
        boolean fresh(int ttlSeconds) {
            return Duration.between(at, Instant.now()).toSeconds() < ttlSeconds;
        }
    }

    @Override
    public List<PlatformIncidentResponse> activeIncidents() {
        Cached current = cached;
        if (current != null && current.fresh(cacheSeconds)) {
            return current.incidents();
        }
        List<PlatformIncidentResponse> incidents = detect();
        cached = new Cached(incidents, Instant.now());
        return incidents;
    }

    @Override
    public boolean isActive(Platform platform) {
        return activeIncidents().stream().anyMatch(i -> i.getPlatform() == platform);
    }

    private List<PlatformIncidentResponse> detect() {
        try {
            Instant since = Instant.now().minus(Duration.ofMinutes(windowMinutes));
            List<PlatformIncidentResponse> incidents = new ArrayList<>();
            for (Object[] row : jobRepository.countFailuresByPlatformSince(since, OUTAGE_SIGNALS)) {
                long failures = ((Number) row[1]).longValue();
                long accounts = ((Number) row[2]).longValue();
                if (failures >= minFailures && accounts >= minAccounts) {
                    incidents.add(adminMonitorMapper.toIncident((Platform) row[0], SqlTemporalUtil.toInstant(row[3]),
                            failures, accounts));
                }
            }
            if (!incidents.isEmpty()) {
                log.warn("[PlatformIncident] Sự cố nền tảng đang mở: {}", incidents);
            }
            return List.copyOf(incidents);
        } catch (Exception e) {
            log.warn("[PlatformIncident] Không đọc được tín hiệu sự cố — coi như không có: {}", e.getMessage());
            return List.of();
        }
    }
}
