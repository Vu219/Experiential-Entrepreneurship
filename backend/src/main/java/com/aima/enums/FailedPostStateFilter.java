package com.aima.enums;

/**
 * Bộ lọc vòng đời của {@code GET /me/failed-posts} (chiều {@link FailureState}). Mặc định {@code NEEDS_ACTION}
 * = đúng tập bài trả về trước khi có vòng đời (lịch FAILED) → client cũ không đổi hành vi.
 */
public enum FailedPostStateFilter {
    NEEDS_ACTION,
    AUTO_RETRYING,
    DISMISSED,
    /** NEEDS_ACTION + AUTO_RETRYING. */
    ACTIVE,
    /** NEEDS_ACTION + AUTO_RETRYING + DISMISSED. */
    ALL
}
