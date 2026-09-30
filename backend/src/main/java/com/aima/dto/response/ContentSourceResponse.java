package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/**
 * Nguồn AI đã dùng để sinh bài (card "Thông tin nguồn" ở màn xem chi tiết) — suy từ job sinh
 * nội dung THÀNH CÔNG gần nhất của bài. Field nào không resolve được (bài chưa sinh, trend/ý tưởng
 * đã xóa) thì null.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentSourceResponse", description = "Strategy / trend / idea the item was generated from.")
public class ContentSourceResponse {

    @Schema(description = "Content strategy used for generation.")
    UUID strategyId;

    @Schema(description = "Strategy display name.")
    String strategyName;

    @Schema(description = "Strategy content goals.")
    List<String> goals;

    @Schema(description = "Attached trend id (null if none).")
    UUID trendId;

    @Schema(description = "Attached trend name.")
    String trendName;

    @Schema(description = "Attached content-idea id (null if none).")
    UUID ideaId;

    @Schema(description = "Attached content-idea title.")
    String ideaTitle;
}
