package com.aima.service;

import java.util.UUID;

/**
 * Worker nền cho tác vụ định dạng nội dung theo nền tảng (FR-40..FR-46, NFR-04) —
 * bean riêng để proxy @Async hoạt động (rule #28).
 */
public interface ContentFormattingWorkerService {

    void process(UUID jobId);
}
