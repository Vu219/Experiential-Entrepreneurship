package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FeedbackResponse", description = "Một lượt đánh giá/góp ý (admin thấy kèm email người gửi).")
public class FeedbackResponse {

    UUID id;

    @Schema(description = "Số sao 1–5.", example = "4")
    Short rating;

    String comment;

    @Schema(example = "/dashboard")
    String page;

    @Schema(description = "Email người gửi — chỉ có ở API admin.")
    String userEmail;

    @Schema(description = "Tên người gửi — chỉ có ở API admin.")
    String userFullName;

    @Schema(description = "true = dữ liệu mô phỏng (dev-seed), không phải đánh giá thật.")
    Boolean sample;

    LocalDateTime createdAt;
}
