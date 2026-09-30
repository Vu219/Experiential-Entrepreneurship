package com.aima.enums;

/** FR-34: trạng thái duyệt của bài — tách khỏi trạng thái tổng {@link ContentItemStatus}. */
public enum ReviewStatus {
    NONE,
    NEED_REVIEW,
    APPROVED,
    CHANGES_REQUESTED
}
