package com.aima.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đồng bộ số liệu bài đã đăng (FR-59, docs/analytics-real-data-plan.md giai đoạn 1): snapshot tích luỹ →
 * số phát sinh theo ngày → mốc 24/48/168h. Gọi nền tảng qua {@link PlatformMetricsProvider}, KHÔNG bao giờ
 * giữ transaction quanh HTTP (rule #24). Không đổi trạng thái bài/lịch (D2).
 */
public interface AnalyticsSyncService {

    /**
     * Việc chuẩn bị mỗi lượt quét: tạo dòng theo dõi cho bài mới đăng, chép mốc cũ trong post_analytics sang
     * snapshot (BACKFILL) cho bài chưa có snapshot. Trả số bài đã xử lý.
     */
    int prepare(int batchSize);

    /** Bài đến hạn đồng bộ, gom theo tài khoản (giữ thứ tự). */
    Map<UUID, List<UUID>> findDue(Instant now, int limit);

    /** Đồng bộ các bài của MỘT tài khoản. {@code false} = bị nền tảng giới hạn tần suất → dừng cả lượt quét. */
    boolean syncAccount(UUID accountId, List<UUID> mediaIds);

    /**
     * Webhook báo bài có tương tác mới (bình luận / cảm xúc / chia sẻ) → đồng bộ bài đó sau {@code delay} (gom nhiều sự kiện
     * vào một lần gọi Meta). Không lùi lịch đã sớm hơn; bỏ qua bài đã dừng theo dõi. Gọi trong transaction của worker.
     * Trả số dòng theo dõi được dời lịch.
     */
    int syncSoon(String platformMediaId, Duration delay);

    /**
     * Webhook báo bài bị xoá trên nền tảng → đánh dấu DELETED + dừng theo dõi ngay (không chờ 2 lần NOT_FOUND). Số liệu cũ
     * giữ nguyên, KHÔNG đổi trạng thái bài AIMA (D2). Gọi trong transaction của worker. Trả số dòng bị đánh dấu.
     */
    int markDeleted(String platformMediaId);

    /** Nút "Làm mới": đưa bài của user về hạn ngay. Trả số bài sẽ được đồng bộ ở lượt quét kế tiếp. */
    int requestSync(UUID userId);
}
