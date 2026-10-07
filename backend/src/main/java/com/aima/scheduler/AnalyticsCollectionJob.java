package com.aima.scheduler;

import com.aima.service.AnalyticsAccountSyncService;
import com.aima.service.AnalyticsSyncService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FR-59/BR-09: đồng bộ số liệu bài đã đăng (docs/analytics-real-data-plan.md giai đoạn 1–2). Mỗi 5 phút:
 * (1) chuẩn bị (bài mới + chép mốc cũ); (2) đồng bộ CẤP TÀI KHOẢN các kênh đến hạn (6 giờ/lần: import bài đăng
 * ngoài AIMA + insights theo ngày của Trang) — chạy trước để bài vừa import được đồng bộ ngay trong lượt;
 * (3) đồng bộ các bài ĐẾN HẠN, gom theo tài khoản. Lịch đến hạn thưa dần nên phần lớn lượt quét không gọi Meta
 * lần nào. Logic nằm ở {@link AnalyticsSyncService} / {@link AnalyticsAccountSyncService}; job chỉ điều phối.
 * Bị nền tảng giới hạn tần suất → dừng cả lượt quét, lượt sau thử lại.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AnalyticsCollectionJob {

    static final int PREPARE_BATCH = 200;
    static final int SYNC_BATCH = 500;
    static final int ACCOUNT_BATCH = 50;

    AnalyticsSyncService analyticsSyncService;
    AnalyticsAccountSyncService analyticsAccountSyncService;

    @Scheduled(fixedDelay = 300_000) // 5 phút; nút "Làm mới" trên trang Phân tích chờ tối đa chừng này
    @SchedulerLock(name = "analytics-collection", lockAtMostFor = "PT50M", lockAtLeastFor = "PT1M")
    public void run() {
        int prepared = analyticsSyncService.prepare(PREPARE_BATCH);
        if (prepared > 0) {
            log.info("[AnalyticsCollection] Đã chuẩn bị {} bài (theo dõi mới / chép mốc cũ)", prepared);
        }
        for (UUID accountId : analyticsAccountSyncService.findDue(Instant.now(), ACCOUNT_BATCH)) {
            if (!analyticsAccountSyncService.sync(accountId)) {
                log.warn("[AnalyticsCollection] Bị nền tảng giới hạn tần suất — dừng lượt quét, thử lại lượt sau");
                return;
            }
        }
        Map<UUID, List<UUID>> due = analyticsSyncService.findDue(Instant.now(), SYNC_BATCH);
        for (Map.Entry<UUID, List<UUID>> account : due.entrySet()) {
            if (!analyticsSyncService.syncAccount(account.getKey(), account.getValue())) {
                log.warn("[AnalyticsCollection] Bị nền tảng giới hạn tần suất — dừng lượt quét, thử lại lượt sau");
                return;
            }
        }
    }
}
