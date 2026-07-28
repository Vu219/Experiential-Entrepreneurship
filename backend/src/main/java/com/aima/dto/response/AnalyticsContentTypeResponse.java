package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Một loại nội dung trong khối F ("Hiệu suất theo loại nội dung"). Nhãn lấy từ
 * {@code content_versions.media_format} chuẩn hoá IN HOA (IMAGE/VIDEO/TEXT/CAROUSEL/…), bản chưa
 * định dạng gom vào {@code OTHER}; FE dịch nhãn qua từ điển sẵn có, nhãn lạ hiển thị nguyên văn.
 *
 * <p>Chỉ trả loại CÓ bài trong kỳ — không bịa ra loại rỗng (dữ liệu MVP không có "Reels" riêng,
 * AI chỉ sinh image/video/text).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsContentTypeResponse", description = "Số liệu gộp của một loại nội dung trong kỳ.")
public class AnalyticsContentTypeResponse {

    @Schema(description = "Nhãn loại nội dung (IN HOA); OTHER = bản chưa có định dạng media.", example = "IMAGE")
    String label;

    @Schema(description = "Số bài đã đăng thuộc loại này trong kỳ.", example = "12")
    long posts;

    @Schema(description = "Lượt xem.", example = "8200")
    long views;

    @Schema(description = "Lượt thích.", example = "640")
    long likes;

    @Schema(description = "Bình luận.", example = "120")
    long comments;

    @Schema(description = "Chia sẻ.", example = "45")
    long shares;

    @Schema(description = "Tương tác = likes + comments + shares.", example = "805")
    long engagement;

    @Schema(description = "Tỷ trọng tương tác của loại này trên tổng (%).", example = "62.5")
    double sharePct;
}
