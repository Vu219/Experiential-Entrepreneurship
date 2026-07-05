package com.aima.service;

import java.util.UUID;

/**
 * Worker nền đăng bài (FR-52..FR-56, NFR-04): xử lý một {@link com.aima.entity.PostingJob}
 * đã được PostingDispatchJob tạo/dispatch. Bean riêng để proxy @Async hoạt động (rule #28).
 */
public interface PostPublishWorkerService {

    void process(UUID jobId);
}
