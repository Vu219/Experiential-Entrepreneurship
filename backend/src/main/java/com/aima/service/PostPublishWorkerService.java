package com.aima.service;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Worker nền đăng bài (FR-52..FR-56, NFR-04): xử lý một {@link com.aima.entity.PostingJob}
 * đã được PostingDispatchJob tạo/dispatch. Bean riêng để proxy @Async hoạt động (rule #28).
 */
public interface PostPublishWorkerService {

    void process(UUID jobId);

    /**
     * Vớt job kẹt RUNNING (bắt đầu trước {@code startedBefore}): ghi thất bại TẠM THỜI rồi đi theo
     * chính sách retry FR-56. Không @Async — chỉ thao tác DB, chạy ngay trên thread scheduler.
     */
    void recoverStuck(UUID jobId, LocalDateTime startedBefore);
}
