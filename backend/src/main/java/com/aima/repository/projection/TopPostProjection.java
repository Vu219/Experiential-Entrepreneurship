package com.aima.repository.projection;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một dòng "Top bài viết hiệu quả" (khối E): bài đã đăng (AIMA hoặc ngoài AIMA) kèm snapshot số liệu MỚI NHẤT.
 * {@code postId}/{@code contentItemId} null với bài ngoài AIMA; {@code mediaId} luôn có (khoá dòng).
 * {@code views} null = chưa có lượt xem (bài đăng trước khi có đồng bộ đầy đủ / chưa cấp quyền) — KHÁC 0;
 * {@code legacyOnly} = snapshot mới nhất là bản chép từ mốc cũ (bài chưa từng được đồng bộ lại).
 * {@code caption}/{@code contentItemId} lấy từ {@code content_versions} để FE hiển thị tiêu đề và
 * điều hướng sang chi tiết/Quản lý nội dung. MVP không có thumbnail (media chỉ là prompt text).
 */
public interface TopPostProjection {

    UUID getMediaId();

    UUID getPostId();

    UUID getContentItemId();

    String getPlatform();

    String getCaption();

    String getAccountName();

    LocalDateTime getPublishedAt();

    Long getViews();

    long getLikes();

    long getComments();

    long getShares();

    long getEngagement();

    boolean getLegacyOnly();

    String getOrigin();

    String getPermalink();

    String getPlatformStatus();
}
