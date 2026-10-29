package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FeedbackRequest", description = "Đánh giá + góp ý gửi từ trong app (G1.3).")
public class FeedbackRequest {

    @NotNull(message = "FEEDBACK_RATING_INVALID")
    @Min(value = 1, message = "FEEDBACK_RATING_INVALID")
    @Max(value = 5, message = "FEEDBACK_RATING_INVALID")
    @Schema(description = "Số sao 1–5.", example = "4")
    Short rating;

    @Size(max = 1000, message = "FEEDBACK_COMMENT_TOO_LONG")
    @Schema(description = "Nhận xét tuỳ chọn, tối đa 1000 ký tự.", example = "Tạo nội dung nhanh, muốn thêm mẫu cho quán cà phê.")
    String comment;

    @Size(max = 120, message = "FEEDBACK_PAGE_TOO_LONG")
    @Schema(description = "Pathname trang đang mở khi gửi (không kèm query string).", example = "/dashboard")
    String page;
}
