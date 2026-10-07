package com.aima.dto.response;

import com.aima.enums.MediaOrigin;
import com.aima.enums.Platform;
import com.aima.enums.PlatformMediaStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một dòng bảng "Top bài viết hiệu quả" (khối E). {@code contentItemId} để FE mở chi tiết bài
 * hoặc điều hướng sang Quản lý nội dung với bộ lọc tương ứng. MVP không có thumbnail.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsTopPostResponse", description = "Bài đã đăng kèm số liệu mốc muộn nhất, cho bảng Top bài viết.")
public class AnalyticsTopPostResponse {

    @Schema(description = "Id dòng theo dõi số liệu (platform_media.id) — luôn có, dùng làm khoá dòng.")
    UUID mediaId;

    @Schema(description = "Id bài đăng (posts.id); null với bài đăng ngoài AIMA.")
    UUID postId;

    @Schema(description = "Id content item nguồn để mở chi tiết / lọc Quản lý nội dung; null nếu bản định dạng đã bị xoá "
            + "hoặc bài đăng ngoài AIMA.")
    UUID contentItemId;

    @Schema(description = "Nền tảng.", example = "FACEBOOK")
    Platform platform;

    @Schema(description = "Tiêu đề = caption đã định dạng; null nếu không có.", example = "Bí quyết chăm sóc da mùa hè")
    String caption;

    @Schema(description = "Tên tài khoản đã đăng.", example = "AIMA Fanpage")
    String accountName;

    @Schema(description = "Thời điểm đăng.", example = "2026-07-20T09:30:00")
    LocalDateTime publishedAt;

    @Schema(description = "Lượt xem.", example = "3200")
    Long views;

    @Schema(description = "Lượt thích.", example = "240")
    long likes;

    @Schema(description = "Bình luận.", example = "36")
    long comments;

    @Schema(description = "Chia sẻ.", example = "18")
    long shares;

    @Schema(description = "Tương tác = likes + comments + shares.", example = "294")
    long engagement;

    @Schema(description = "true = số liệu duy nhất là bản chép từ mốc cũ (bài đăng trước khi có đồng bộ đầy đủ) — "
            + "views null ở đây nghĩa là không có số liệu tại mốc, FE hiện \"—\".", example = "false")
    boolean legacyOnly;

    @Schema(description = "AIMA = đăng qua AIMA; EXTERNAL = người dùng tự đăng trên nền tảng (import giai đoạn 2).",
            example = "AIMA")
    MediaOrigin origin;

    @Schema(description = "Đường dẫn bài trên nền tảng; null khi chưa quét được.")
    String permalink;

    @Schema(description = "Bài còn trên nền tảng không (DELETED = đã xoá trên nền tảng, số liệu cũ giữ nguyên).",
            example = "ACTIVE")
    PlatformMediaStatus platformStatus;
}
