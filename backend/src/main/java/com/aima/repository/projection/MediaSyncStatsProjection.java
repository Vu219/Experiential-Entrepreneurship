package com.aima.repository.projection;

import java.time.Instant;
import java.util.UUID;

/** Trạng thái đồng bộ số liệu gộp theo một tài khoản (GET /analytics/sync-status). */
public interface MediaSyncStatsProjection {

    UUID getAccountId();

    long getTrackedPosts();

    /** Bài chưa đồng bộ lần nào (đang chờ lượt quét đầu tiên). */
    long getPendingPosts();

    long getStoppedPosts();

    /** Bài đang lỗi thiếu quyền. */
    long getPermissionErrors();

    Instant getLastSyncedAt();
}
