package com.aima.service;

/**
 * Phần GHI bất đồng bộ của {@link ActivityLogService} — tách thành bean riêng để proxy
 * {@code @Async} thực sự có tác dụng (self-invocation trong cùng bean sẽ chạy đồng bộ,
 * rule #28). Không gọi trực tiếp từ code nghiệp vụ: dùng {@link ActivityLogService#record}.
 */
public interface ActivityLogWriter {

    /**
     * Dedup rồi ghi một dòng {@code activity_logs}. IP/User-Agent phải được chụp SẴN trên
     * thread request (thread này không còn request context). Mọi lỗi bị nuốt.
     */
    void write(ActivityLogService.Entry entry, String ip, String userAgent);
}
