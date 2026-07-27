package com.aima.repository.projection;

/**
 * Số liệu gộp của MỘT loại nội dung trong kỳ (khối F — "Hiệu suất theo loại nội dung").
 * {@code label} = {@code content_versions.media_format} đã chuẩn hoá IN HOA (IMAGE/VIDEO/TEXT/…);
 * bản chưa định dạng (media_format null/rỗng) gom vào nhãn {@code OTHER} — cùng quy ước với donut
 * "Loại nội dung" của Bảng điều khiển. Mỗi bài chỉ góp một snapshot mốc muộn nhất (không đếm trùng).
 */
public interface ContentTypeMetricProjection {

    String getLabel();

    long getPosts();

    long getViews();

    long getLikes();

    long getComments();

    long getShares();

    long getEngagement();
}
