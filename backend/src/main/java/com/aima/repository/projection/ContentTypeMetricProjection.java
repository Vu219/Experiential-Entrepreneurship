package com.aima.repository.projection;

/**
 * Số liệu gộp của MỘT loại nội dung trong kỳ (khối F — "Hiệu suất theo loại nội dung").
 * {@code label} = loại bài do nền tảng báo ({@code platform_media.media_type}: IMAGE/VIDEO/TEXT/OTHER); bài AIMA
 * chưa có nhãn nền tảng = TEXT, bài ngoài không rõ = OTHER. Mỗi bài chỉ góp một snapshot mới nhất (không đếm trùng).
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
