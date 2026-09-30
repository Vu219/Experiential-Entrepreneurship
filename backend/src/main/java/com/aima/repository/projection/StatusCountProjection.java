package com.aima.repository.projection;

import com.aima.enums.ContentItemStatus;
import com.aima.enums.ReviewStatus;

/**
 * Kết quả gộp "đếm bài theo trạng thái hiện tại" (thẻ số liệu Bảng điều khiển) — một truy vấn
 * GROUP BY thay cho N truy vấn count riêng lẻ.
 */
public interface StatusCountProjection {

    ContentItemStatus getStatus();

    ReviewStatus getReviewStatus();

    long getTotal();
}
