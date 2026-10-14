package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

/**
 * Kết quả ô tìm kiếm toàn cục ({@code GET /search}) — dữ liệu CỦA CHÍNH user, chia theo nhóm, mỗi nhóm tối đa
 * {@code limit} mục + tổng số khớp. Mỗi mục dùng lại đúng DTO của API danh sách tương ứng để FE hiển thị nhất quán.
 * Nhóm không có kết quả trả mảng RỖNG (không null) — MapStruct bỏ qua trang rỗng nên cần {@code @Builder.Default}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "GlobalSearchResponse", description = "Global search results for the caller, grouped by type.")
public class GlobalSearchResponse {

    @Schema(description = "Content items whose platform versions match (caption, script hook, hashtags), newest first.")
    @Builder.Default
    List<ContentItemResponse> contents = new ArrayList<>();

    @Schema(description = "Total number of matching content items.", example = "12")
    long contentTotal;

    @Schema(description = "Content strategies whose name matches, newest first.")
    @Builder.Default
    List<ContentStrategyResponse> strategies = new ArrayList<>();

    @Schema(description = "Total number of matching strategies.", example = "2")
    long strategyTotal;

    @Schema(description = "Non-cancelled schedules whose post or target account matches, latest publish time first.")
    @Builder.Default
    List<PostScheduleResponse> schedules = new ArrayList<>();

    @Schema(description = "Total number of matching schedules.", example = "3")
    long scheduleTotal;
}
