package com.aima.service;

import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Tín hiệu Dừng cho job tạo nội dung đang stream TRÊN INSTANCE NÀY. User bấm Dừng ở instance nào cũng được: lệnh
 * {@code job.cancel} đi qua bus realtime tới mọi instance, instance giữ job huỷ luồng AI (→ provider ngừng sinh).
 */
public interface GenerationCancelService {

    /** Đăng ký job đang chạy; Mono hoàn tất khi có lệnh huỷ. */
    Mono<Void> register(UUID jobId);

    void unregister(UUID jobId);

    /** Phát lệnh huỷ tới mọi instance (sau commit). */
    void requestCancel(UUID jobId);
}
