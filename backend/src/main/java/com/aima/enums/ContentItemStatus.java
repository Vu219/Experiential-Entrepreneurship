package com.aima.enums;

import java.util.EnumSet;
import java.util.Set;

/**
 * Trạng thái TỔNG của một bài — giá trị SUY RA từ bản nền tảng + lịch đăng, chỉ
 * {@code ContentItemStatusResolver} được ghi. Duyệt ({@link ReviewStatus}) và analytics
 * nằm ở chiều riêng, không điều khiển trạng thái này.
 */
public enum ContentItemStatus {
    DRAFT,
    GENERATED,
    FORMATTED,
    SCHEDULED,
    ON_HOLD,
    POSTING,
    POSTED,
    PARTIALLY_POSTED,
    FAILED;

    /** Chưa có lịch hiệu lực và chưa bản nào đăng — bài còn ở giai đoạn sản xuất. */
    public static final Set<ContentItemStatus> PRE_PUBLISHING = EnumSet.of(DRAFT, GENERATED, FORMATTED);

    public boolean isPrePublishing() {
        return PRE_PUBLISHING.contains(this);
    }
}
