package com.aima.scheduler;

import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.TokenUsageService;
import com.aima.service.TrendResearchWorkerService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * FR-19: nghiên cứu xu hướng tự động lúc 02:00 mỗi ngày. Quét các hồ sơ thương hiệu đang hoạt động
 * (isActive) có chiến lược ACTIVE (BR-01, BR-03); bỏ qua user đang có phiên PENDING/RUNNING
 * (không chạy song song — cùng guard với "Research ngay"). Phiên được xử lý bởi worker nền
 * {@link TrendResearchWorkerService} như luồng thủ công. Resilient: lỗi từng hồ sơ được log + bỏ qua.
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
    UserRepository userRepository;

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
        ContentStrategy strategy = contentStrategyRepository
                .findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                        brand.getId(), StrategyStatus.ACTIVE)
                .orElse(null);
        if (strategy == null) {
            return false; // thiếu chiến lược ACTIVE — không tự nghiên cứu
        }
        if (sessionRepository.existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(
                brand.getUser().getId(), List.of(ResearchStatus.PENDING, ResearchStatus.RUNNING))) {
            return false; // đã có phiên đang chạy cho user này
        }
        // Nạp lại User: brand.getUser() là proxy lazy của một session đã đóng (job không có
        // transaction) — checkQuota đọc user.getPlan() trên đó là LazyInitializationException.
        User user = userRepository.findById(brand.getUser().getId()).orElseThrow();
        try {
            tokenUsageService.checkQuota(user);
        } catch (AppException e) {
            log.info("[DailyTrendResearch] Bỏ qua hồ sơ {} — user hết hạn mức token tháng", brand.getId());
            return false; // cùng chính sách chặn với "Research ngay"
        }

        // Không có transaction bao ngoài — save commit ngay nên dispatch worker trực tiếp
        // (khác luồng "Research ngay" phải chờ afterCommit).
        TrendResearchSession session = sessionRepository
                .save(trendResearchMapper.toSession(brand, Platform.FACEBOOK, strategy, null));
        trendResearchWorkerService.process(session.getId());
        log.info("[DailyTrendResearch] Đã tạo phiên {} cho hồ sơ {}", session.getId(), brand.getId());
        return true;
    }
}
