package com.aima.service;

import java.util.UUID;

/**
 * Xử lý BẤT ĐỒNG BỘ các thay đổi webhook Meta đã lưu ở {@code meta_webhook_events} (analytics giai đoạn 3). Bean riêng để
 * {@code @Async} áp dụng được (rule #28). Mỗi sự kiện xử lý trong MỘT transaction, khoá dòng sự kiện nên worker async và
 * job quét lại không bao giờ xử lý cùng một sự kiện hai lần.
 */
public interface MetaWebhookEventWorker {

    /** Xử lý một sự kiện PENDING (chạy trên executor riêng). Không ném lỗi ra ngoài. */
    void process(UUID eventId);

    /** Job quét lại: xử lý (đồng bộ) các sự kiện còn PENDING quá lâu. Trả số sự kiện đã thử. */
    int processStale(int limit);
}
