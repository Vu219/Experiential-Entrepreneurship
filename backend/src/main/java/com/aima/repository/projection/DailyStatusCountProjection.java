package com.aima.repository.projection;

/**
 * Số bài TẠO RA mỗi ngày, tách theo trạng thái — nguồn chung cho sparkline (7 ngày gần nhất)
 * và % thay đổi (7 ngày qua so với 7 ngày liền trước) của các thẻ số liệu Bảng điều khiển.
 *
 * <p>{@code day} là chuỗi {@code yyyy-MM-dd} (native {@code to_char}) và {@code status} là tên
 * enum {@link com.aima.enums.ContentItemStatus} dạng chuỗi, {@code reviewStatus} là tên
 * {@link com.aima.enums.ReviewStatus} — native query trả cột varchar.
 */
public interface DailyStatusCountProjection {

    String getDay();

    String getStatus();

    String getReviewStatus();

    long getTotal();
}
