package com.aima.service.Impl;

import com.aima.dto.request.PlatformAvailabilityRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlatformAccessListResponse;
import com.aima.dto.response.PlatformAccessResponse;
import com.aima.dto.response.PlatformAvailabilityResponse;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformAvailability;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.PlatformLockReason;
import com.aima.enums.PlanLimitKey;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformAvailabilityMapper;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformAvailabilityRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.PlanLimitService;
import com.aima.service.PlanUsageService;
import com.aima.service.PlatformAvailabilityService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.service.ScheduleHoldService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class PlatformAvailabilityServiceImpl implements PlatformAvailabilityService {

    /** Lịch chưa đăng — bị giữ khi nền tảng bị khoá. */
    static final List<ScheduleStatus> PENDING = List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    PlatformAvailabilityRepository availabilityRepository;
    PlatformAccountRepository accountRepository;
    PostScheduleRepository scheduleRepository;
    UserRepository userRepository;
    ScheduleHoldService holdService;
    ScheduleHeldNotifier heldNotifier;
    ActivityLogService activityLogService;
    PlanLimitService planLimitService;
    PlanUsageService planUsageService;
    PlatformAvailabilityMapper availabilityMapper;

    /** Chỉ là giá trị SEED khi chưa có dòng (env AIMA_CONNECTION_ENABLED_PLATFORMS) — nguồn sự thật là DB. */
    @NonFinal
    @Value("${aima.connections.enabled-platforms:FACEBOOK}")
    Set<Platform> seedEnabledPlatforms = EnumSet.of(Platform.FACEBOOK);

    ConcurrentHashMap<Platform, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(boolean enabled, Instant cachedAt) {
        boolean fresh() {
            return cachedAt.plus(CACHE_TTL).isAfter(Instant.now());
        }
    }

    // ------------------------------------------------------------------ hệ thống

    @Override
    @Transactional(readOnly = true)
    public boolean isEnabled(Platform platform) {
        Cached cached = cache.get(platform);
        if (cached != null && cached.fresh()) {
            return cached.enabled();
        }
        boolean enabled = isEnabledNow(platform);
        cache.put(platform, new Cached(enabled, Instant.now()));
        return enabled;
    }

    /** Đọc thẳng DB. Chưa có dòng (DB chưa seed) → theo giá trị seed, không mở ngoài ý muốn. */
    private boolean isEnabledNow(Platform platform) {
        return availabilityRepository.findByPlatformAndDeletedAtIsNull(platform)
                .map(PlatformAvailability::getConnectionEnabled)
                .orElse(seedEnabledPlatforms.contains(platform));
    }

    @Override
    @Transactional(readOnly = true)
    public void requireConnectable(Platform platform) {
        if (!isEnabled(platform)) {
            throw new AppException(ErrorCode.PLATFORM_CONNECTION_DISABLED);
        }
    }

    // ------------------------------------------------------------------ theo user

    @Override
    @Transactional
    public PlatformLockReason lockReason(User user, Platform platform) {
        if (!isEnabled(platform)) {
            return PlatformLockReason.PLATFORM_DISABLED;
        }
        return planAllows(user, platform) ? null : PlatformLockReason.PLAN_EXCLUDED;
    }

    @Override
    @Transactional
    public PlatformLockReason lockReasonNow(User user, Platform platform) {
        boolean enabled = isEnabledNow(platform);
        cache.put(platform, new Cached(enabled, Instant.now()));
        if (!enabled) {
            return PlatformLockReason.PLATFORM_DISABLED;
        }
        return planAllows(user, platform) ? null : PlatformLockReason.PLAN_EXCLUDED;
    }

    @Override
    @Transactional
    public Map<Platform, PlatformLockReason> lockReasons(User user) {
        Map<Platform, PlatformLockReason> reasons = new EnumMap<>(Platform.class);
        for (Platform platform : Platform.values()) {
            reasons.put(platform, lockReason(user, platform));
        }
        return reasons;
    }

    @Override
    @Transactional
    public void requireUsable(User user, Platform platform) {
        if (!isEnabled(platform)) {
            throw new AppException(ErrorCode.SCHEDULE_PLATFORM_DISABLED);
        }
        planUsageService.requirePlatform(user, platform);
    }

    /** Gói của user có gồm nền tảng không (ALLOWED_PLATFORMS). */
    private boolean planAllows(User user, Platform platform) {
        return planLimitService.features(user).allows(platform);
    }

    @Override
    @Transactional
    public ApiResponse<PlatformAccessListResponse> myPlatforms(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        PlanLimitService.FeatureLimits limits = planLimitService.features(user);
        Map<Platform, PlatformAvailability> rows = rowsByPlatform();
        List<PlatformAccessResponse> platforms = new ArrayList<>();
        for (Platform platform : Platform.values()) {
            PlatformAvailability row = rows.getOrDefault(platform,
                    availabilityMapper.toAvailability(platform, seedEnabledPlatforms.contains(platform)));
            boolean planAllowed = limits.allows(platform);
            PlatformLockReason reason = !Boolean.TRUE.equals(row.getConnectionEnabled())
                    ? PlatformLockReason.PLATFORM_DISABLED
                    : planAllowed ? null : PlatformLockReason.PLAN_EXCLUDED;
            platforms.add(availabilityMapper.toAccessResponse(platform, row, planAllowed, reason));
        }
        long connected = accountRepository.countByUser_IdAndAccountTypeNotAndDeletedAtIsNull(user.getId(),
                PlatformAccountType.USER);
        PlatformAccessListResponse response = PlatformAccessListResponse.builder()
                .platforms(platforms)
                .remainingChannels(planUsageService.remainingChannels(user))
                .channelLimit(limits.limit(PlanLimitKey.CONNECTED_CHANNELS))
                .connectedChannels(connected)
                .build();
        return ApiResponse.success("Quyền dùng nền tảng", response);
    }

    // ------------------------------------------------------------------ admin

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PlatformAvailabilityResponse>> list() {
        Map<Platform, PlatformAvailability> rows = rowsByPlatform();
        List<PlatformAvailabilityResponse> responses = new ArrayList<>();
        for (Platform platform : Platform.values()) {
            PlatformAvailability row = rows.getOrDefault(platform,
                    availabilityMapper.toAvailability(platform, seedEnabledPlatforms.contains(platform)));
            responses.add(toResponse(row, null));
        }
        return ApiResponse.success("Trạng thái liên kết nền tảng", responses);
    }

    @Override
    public ApiResponse<PlatformAvailabilityResponse> update(Platform platform, PlatformAvailabilityRequest request,
                                                           String adminEmail) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        boolean enable = Boolean.TRUE.equals(request.getEnabled());
        String reasonVi = trimToNull(request.getReasonVi());
        String reasonEn = trimToNull(request.getReasonEn());
        if (!enable && (reasonVi == null || reasonEn == null)) {
            throw new AppException(ErrorCode.PLATFORM_LOCK_REASON_REQUIRED);
        }
        PlatformAvailability row = availabilityRepository.findByPlatformAndDeletedAtIsNull(platform)
                .orElseGet(() -> availabilityMapper.toAvailability(platform, seedEnabledPlatforms.contains(platform)));
        boolean wasEnabled = Boolean.TRUE.equals(row.getConnectionEnabled());
        LocalDateTime now = LocalDateTime.now();
        if (wasEnabled != enable) {
            row.setStatusChangedAt(now);
        }
        row.setConnectionEnabled(enable);
        row.setReasonVi(enable ? null : reasonVi);
        row.setReasonEn(enable ? null : reasonEn);
        row.setUpdatedById(admin.getId());
        row.setUpdatedByEmail(admin.getEmail());
        PlatformAvailability saved = availabilityRepository.saveAndFlush(row);
        cache.remove(platform);

        Integer held = null;
        if (wasEnabled && !enable) {
            held = holdPendingSchedules(platform, "admin:" + now.toEpochSecond(ZoneOffset.UTC));
        }
        log.info("[PlatformAvailability] {} {} bởi {} — {} lịch chuyển Tạm giữ", platform, enable ? "MỞ" : "KHOÁ",
                adminEmail, held == null ? 0 : held);
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("from", wasEnabled ? "ENABLED" : "DISABLED");
        metadata.put("to", enable ? "ENABLED" : "DISABLED");
        metadata.put("heldSchedules", String.valueOf(held == null ? 0 : held));
        activityLogService.record(ActivityLogService.Entry.byActor(ActivityAction.PLATFORM_AVAILABILITY_UPDATED,
                adminEmail, "PlatformAvailability", platform.name(), metadata));
        PlatformAvailabilityResponse response = toResponse(saved, held);
        return ApiResponse.success(enable ? "Đã mở liên kết nền tảng" : "Đã khoá liên kết nền tảng", response);
    }

    @Override
    public int seedDefaults() {
        int held = 0;
        for (Platform platform : Platform.values()) {
            if (availabilityRepository.findByPlatformAndDeletedAtIsNull(platform).isPresent()) {
                continue;
            }
            boolean enabled = seedEnabledPlatforms.contains(platform);
            PlatformAvailability row = availabilityMapper.toAvailability(platform, enabled);
            row.setStatusChangedAt(LocalDateTime.now());
            availabilityRepository.saveAndFlush(row);
            cache.remove(platform);
            log.info("[PlatformAvailability] Seed {} = {}", platform, enabled ? "MỞ" : "KHOÁ");
            if (!enabled) {
                // Một lần duy nhất (dòng vừa tạo): lịch chưa đăng của kết nối có từ trước khi khoá → giữ lại.
                held += holdPendingSchedules(platform, "initial");
            }
        }
        return held;
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Giữ mọi lịch chưa đăng của các kết nối trên nền tảng (PLATFORM_DISABLED) + một thông báo / user. Lịch đã có lý
     * do này không tính lại (idempotent); dedupe thông báo theo {@code tag}.
     */
    private int holdPendingSchedules(Platform platform, String tag) {
        List<UUID> accountIds = accountRepository.findByPlatformNameAndDeletedAtIsNull(platform).stream()
                .map(PlatformAccount::getId).toList();
        if (accountIds.isEmpty()) {
            return 0;
        }
        Map<UUID, User> owners = new LinkedHashMap<>();
        Map<UUID, Integer> newlyHeldByUser = new LinkedHashMap<>();
        for (PostSchedule schedule : scheduleRepository.findByPlatformAccount_IdInAndStatusInAndDeletedAtIsNull(accountIds, PENDING)) {
            boolean alreadyHeld = schedule.getHolds().stream().anyMatch(h -> h.getReason() == HoldReason.PLATFORM_DISABLED);
            if (alreadyHeld) {
                continue;
            }
            User owner = schedule.getPlatformAccount().getUser();
            owners.putIfAbsent(owner.getId(), owner);
            newlyHeldByUser.merge(owner.getId(), 1, Integer::sum);
        }
        int held = holdService.holdForAccounts(accountIds, HoldReason.PLATFORM_DISABLED);
        newlyHeldByUser.forEach((userId, count) -> heldNotifier.notifyBatch(owners.get(userId), HoldReason.PLATFORM_DISABLED,
                platform, count, "schedule-held:" + HoldReason.PLATFORM_DISABLED + ":" + platform + ":" + userId + ":" + tag));
        return held;
    }

    private PlatformAvailabilityResponse toResponse(PlatformAvailability row, Integer held) {
        long connected = accountRepository.countByPlatformNameAndAccountTypeNotAndDeletedAtIsNull(row.getPlatform(),
                PlatformAccountType.USER);
        long pending = scheduleRepository
                .countByPlatformAccount_PlatformNameAndPlatformAccount_DeletedAtIsNullAndStatusInAndDeletedAtIsNull(
                        row.getPlatform(), PENDING);
        return availabilityMapper.toResponse(row, connected, pending, held);
    }

    private Map<Platform, PlatformAvailability> rowsByPlatform() {
        Map<Platform, PlatformAvailability> rows = new EnumMap<>(Platform.class);
        availabilityRepository.findByDeletedAtIsNull().forEach(row -> rows.put(row.getPlatform(), row));
        return rows;
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.strip() : null;
    }
}
