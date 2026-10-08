package com.aima.scheduler;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
import com.aima.enums.StrategyStatus;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
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
 * FR-19: nghiên cứu xu hướng tự động lúc 02:00 mỗi ngày. Quét các hồ sơ thương hiệu đang hoạt động
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
    TransactionTemplate transactionTemplate;

    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(name = "daily-trend-research", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void run() {
        List<BrandProfile> brands = brandProfileRepository.findByIsActiveTrueAndDeletedAtIsNull();
        if (brands.isEmpty()) {
            log.info("[DailyTrendResearch] Không có hồ sơ thương hiệu đang hoạt động.");
            return;
        }

        int started = 0;
        for (BrandProfile brand : brands) {
            try {
                if (startResearchFor(brand)) {
                    started++;
                }
            } catch (Exception e) {
                log.warn("[DailyTrendResearch] Bỏ qua hồ sơ {}: {}", brand.getId(), e.getMessage(), e);
            }
        }
        log.info("[DailyTrendResearch] Đã khởi động {}/{} phiên nghiên cứu.", started, brands.size());
    }

    private boolean startResearchFor(BrandProfile brand) {
        // Đọc strategy/platforms (collection lazy) + tạo session trong MỘT transaction ngắn, dispatch sau
        // khi commit (worker phải thấy row). Job không có transaction bao ngoài.
        UUID sessionId = transactionTemplate.execute(status -> createSession(brand.getId()));
        if (sessionId == null) {
            return false;
        }
        try {
            trendResearchWorkerService.processScheduled(sessionId);
        } catch (TaskRejectedException e) {
            sessionRepository.failPending(sessionId, LocalDateTime.now(), "Hàng đợi nghiên cứu tự động đã đầy");
            return false;
        }
        log.info("[DailyTrendResearch] Đã tạo phiên {} cho hồ sơ {}", sessionId, brand.getId());
        return true;
    }

    private UUID createSession(UUID brandId) {
        BrandProfile brand = brandProfileRepository.findById(brandId).orElse(null);
        if (brand == null || brand.getDeletedAt() != null) {
            return null;
        }
        ContentStrategy strategy = contentStrategyRepository
                .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                        brand.getId(), StrategyStatus.ACTIVE)
                .orElse(null);
        if (strategy == null) {
            return null; // thiếu chiến lược ACTIVE — không tự nghiên cứu
        }
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

        TrendResearchSession session = sessionRepository.save(trendResearchMapper.toSession(
                brand, platformOf(strategy, brand), strategy, null, ResearchTrigger.SCHEDULED));
        return session.getId();
    }

    /** Nền tảng chính của phiên tự động: theo chiến lược, rồi theo hồ sơ, theo thứ tự scope (FB → IG → Threads). */
    static Platform platformOf(ContentStrategy strategy, BrandProfile brand) {
        Set<Platform> platforms = !strategy.getPlatforms().isEmpty() ? strategy.getPlatforms() : brand.getPlatforms();
        return Arrays.stream(Platform.values()).filter(platforms::contains).findFirst().orElse(Platform.FACEBOOK);
    }
}
