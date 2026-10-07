package com.aima.scheduler;

import com.aima.service.MetaWebhookEventWorker;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Lưới an toàn cho webhook Meta (analytics giai đoạn 3): sự kiện đã lưu nhưng worker async chưa xử lý (app khởi động lại,
 * hàng đợi đầy, lỗi tạm) quá 2 phút thì xử lý lại tại đây — tối đa 3 lần rồi FAILED. Logic ở {@link MetaWebhookEventWorker}.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MetaWebhookEventJob {

    static final int BATCH = 200;

    MetaWebhookEventWorker worker;

    @Scheduled(fixedDelay = 60_000)
    @SchedulerLock(name = "meta-webhook-events", lockAtMostFor = "PT10M", lockAtLeastFor = "PT20S")
    public void run() {
        int tried = worker.processStale(BATCH);
        if (tried > 0) {
            log.info("[MetaWebhookEventJob] Xử lý lại {} sự kiện webhook bị kẹt", tried);
        }
    }
}
