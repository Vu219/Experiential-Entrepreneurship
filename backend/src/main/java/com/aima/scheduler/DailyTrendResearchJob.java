package com.aima.scheduler;

import com.aima.service.Impl.TrendResearchWorkerServiceImpl;
import com.aima.enums.PlanLimitKey;
import com.aima.service.PlanLimitService;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.TrendResearchSchedule;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
import com.aima.enums.StrategyStatus;
import com.aima.enums.TrendScheduleFrequency;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendResearchScheduleRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.service.TokenUsageService;
import com.aima.service.TrendResearchWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * FR-19: nghiên cứu xu hướng tự động — mỗi giờ chạy các lịch riêng của user đến giờ (V19, {@code TrendResearchSchedule}),
 * và lúc 02:00 chạy mặc định cho user chưa tự đặt lịch. Quét các hồ sơ thương hiệu đang hoạt động
 * (isActive) có chiến lược ACTIVE (BR-01, BR-03); bỏ qua user đang có phiên PENDING/RUNNING
 * (không chạy song song — cùng guard với "Research ngay"). Phiên được xử lý bởi worker nền
 * {@link TrendResearchWorkerService#processScheduled} trên hàng đợi riêng (không chiếm luồng "Research ngay";
 * user bấm "Research ngay" khi phiên tự động còn xếp hàng thì phiên tự động bị thay thế). Nền tảng của
 * phiên = nền tảng đầu tiên của chiến lược theo thứ tự scope. Resilient: lỗi từng hồ sơ được log + bỏ qua.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class DailyTrendResearchJob {

    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    TrendResearchSessionRepository sessionRepository;
    TrendResearchMapper trendResearchMapper;
    TrendResearchWorkerService trendResearchWorkerService;
    TokenUsageService tokenUsageService;
    PlanLimitService planLimitService;
    TransactionTemplate transactionTemplate;
    TrendResearchScheduleRepository scheduleRepository;

    /** Giờ chạy mặc định cho user CHƯA tự đặt lịch (V19) — giữ hành vi FR-19 cũ. */
    static final int DEFAULT_HOUR = 2;

    // Mỗi giờ (V19): lịch riêng của user chạy đúng giờ họ chọn; user chưa đặt lịch vẫn chạy lúc 02:00.
    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "daily-trend-research", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        int started = runCustomSchedules(now);
        if (now.getHour() == DEFAULT_HOUR) {
            started += runDefault();
        }
        if (started > 0) {
            log.info("[DailyTrendResearch] Lượt {}h: đã khởi động {} phiên nghiên cứu.", now.getHour(), started);
        }
    }

    private int runCustomSchedules(LocalDateTime now) {
        int started = 0;
        for (TrendResearchSchedule schedule : scheduleRepository.findByEnabledTrueAndDeletedAtIsNull()) {
            if (!isDue(schedule, now)) {
                continue;
            }
            try {
                UUID scheduleId = schedule.getId();
                if (dispatch(transactionTemplate.execute(status -> createSessionFromSchedule(scheduleId, now)))) {
                    started++;
                }
            } catch (Exception e) {
                log.warn("[DailyTrendResearch] Bỏ qua lịch {}: {}", schedule.getId(), e.getMessage(), e);
            }
        }
        return started;
    }

    private int runDefault() {
        List<BrandProfile> brands = brandProfileRepository.findByIsActiveTrueAndDeletedAtIsNull();
        Set<UUID> customised = scheduleRepository.findUserIdsWithSchedule();
        int started = 0;
        for (BrandProfile brand : brands) {
            if (customised.contains(brand.getUser().getId())) {
                continue; // user đã tự đặt lịch (hoặc tắt) — không chạy lượt mặc định
            }
            try {
                if (startResearchFor(brand)) {
                    started++;
                }
            } catch (Exception e) {
                log.warn("[DailyTrendResearch] Bỏ qua hồ sơ {}: {}", brand.getId(), e.getMessage(), e);
            }
        }
        return started;
    }

    /** Đến giờ: cùng giờ (phút bỏ qua), đúng thứ khi WEEKLY, chưa chạy hôm nay. Thứ: 0 = Thứ Hai … 6 = Chủ nhật. */
    static boolean isDue(TrendResearchSchedule schedule, LocalDateTime now) {
        if (schedule.getRunTime() == null || schedule.getRunTime().getHour() != now.getHour()) {
            return false;
        }
        if (schedule.getLastRunAt() != null && !schedule.getLastRunAt().toLocalDate().isBefore(now.toLocalDate())) {
            return false;
        }
        if (schedule.getFrequency() == TrendScheduleFrequency.WEEKLY) {
            String today = String.valueOf(now.getDayOfWeek().getValue() - 1);
            return schedule.getDays() != null && Arrays.asList(schedule.getDays().split(",")).contains(today);
        }
        return true;
    }

    private boolean startResearchFor(BrandProfile brand) {
        // Đọc strategy/platforms (collection lazy) + tạo session trong MỘT transaction ngắn, dispatch sau
        // khi commit (worker phải thấy row). Job không có transaction bao ngoài.
        return dispatch(transactionTemplate.execute(status -> createSession(brand.getId())));
    }

    private boolean dispatch(UUID sessionId) {
        if (sessionId == null) {
            return false;
        }
        try {
            trendResearchWorkerService.processScheduled(sessionId);
        } catch (TaskRejectedException e) {
            sessionRepository.failPending(sessionId, LocalDateTime.now(), "Hàng đợi nghiên cứu tự động đã đầy");
            return false;
        }
        log.info("[DailyTrendResearch] Đã tạo phiên tự động {}", sessionId);
        return true;
    }

    private UUID createSession(UUID brandId) {
        BrandProfile brand = brandProfileRepository.findById(brandId).orElse(null);
        if (brand == null || brand.getDeletedAt() != null) {
            return null;
        }
        ContentStrategy strategy = latestActiveStrategy(brand);
        if (strategy == null) {
            return null; // thiếu chiến lược ACTIVE — không tự nghiên cứu
        }
        return createSession(brand, strategy, platformOf(strategy, brand));
    }

    /**
     * Lịch riêng của user: hồ sơ của lịch (bị xoá → hồ sơ đang hoạt động), chiến lược của lịch nếu còn ACTIVE (không
     * thì ACTIVE mới nhất), nền tảng đầu tiên của lịch theo thứ tự scope. Ghi {@code lastRunAt} để không chạy lại trong
     * ngày dù phiên bị bỏ qua (hết token, đang có phiên chạy...).
     */
    private UUID createSessionFromSchedule(UUID scheduleId, LocalDateTime now) {
        TrendResearchSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null || schedule.getDeletedAt() != null || !Boolean.TRUE.equals(schedule.getEnabled())
                || !isDue(schedule, now)) {
            return null;
        }
        schedule.setLastRunAt(now);
        scheduleRepository.save(schedule);

        BrandProfile brand = schedule.getBrandProfile() != null && schedule.getBrandProfile().getDeletedAt() == null
                ? schedule.getBrandProfile()
                : brandProfileRepository.findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(schedule.getUser().getId())
                        .orElse(null);
        if (brand == null) {
            return null;
        }
        ContentStrategy chosen = schedule.getContentStrategy();
        ContentStrategy strategy = chosen != null && chosen.getDeletedAt() == null && chosen.getStatus() == StrategyStatus.ACTIVE
                && chosen.getBrandProfile().getId().equals(brand.getId()) ? chosen : latestActiveStrategy(brand);
        if (strategy == null) {
            return null;
        }
        Set<String> wanted = Set.of(schedule.getPlatforms().split(","));
        Platform platform = Arrays.stream(Platform.values()).filter(p -> wanted.contains(p.name())).findFirst()
                .orElse(platformOf(strategy, brand));
        return createSession(brand, strategy, platform);
    }

    private ContentStrategy latestActiveStrategy(BrandProfile brand) {
        return contentStrategyRepository
                .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(brand.getId(), StrategyStatus.ACTIVE)
                .orElse(null);
    }

    private UUID createSession(BrandProfile brand, ContentStrategy strategy, Platform platform) {
        User user = brand.getUser();
        if (user.getStatus() != UserStatus.ACTIVE) {
            return null; // tài khoản bị khoá / đang chờ xoá — không tốn tài nguyên cho họ
        }
        if (sessionRepository.existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(
                user.getId(), List.of(ResearchStatus.PENDING, ResearchStatus.RUNNING))) {
            return null; // đã có phiên đang chạy cho user này
        }
        try {
            tokenUsageService.checkQuota(user);
        } catch (AppException e) {
            log.info("[DailyTrendResearch] Bỏ qua hồ sơ {} — user hết hạn mức token tháng", brand.getId());
            return null; // cùng chính sách chặn với "Research ngay"
        }

        PlanLimitService.FeatureLimits limits = planLimitService.features(user);
        if (!limits.included(PlanLimitKey.AUTO_TREND_RESEARCH)) {
            return null; // gói không gồm nghiên cứu tự động 2:00
        }
        // Không chọn số ý tưởng ở lượt tự động → mặc định worker, kẹp về trần của gói.
        Long ideaCap = limits.limit(PlanLimitKey.IDEAS_PER_RESEARCH);
        Integer articleCount = ideaCap != null && ideaCap > 0 && ideaCap < TrendResearchWorkerServiceImpl.MAX_IDEAS
                ? ideaCap.intValue() : null;

        TrendResearchSession session = sessionRepository.save(trendResearchMapper.toSession(
                brand, platform, strategy, articleCount, ResearchTrigger.SCHEDULED));
        return session.getId();
    }

    /** Nền tảng chính của phiên tự động: theo chiến lược, rồi theo hồ sơ, theo thứ tự scope (FB → IG → Threads). */
    static Platform platformOf(ContentStrategy strategy, BrandProfile brand) {
        Set<Platform> platforms = !strategy.getPlatforms().isEmpty() ? strategy.getPlatforms() : brand.getPlatforms();
        return Arrays.stream(Platform.values()).filter(platforms::contains).findFirst().orElse(Platform.FACEBOOK);
    }
}
