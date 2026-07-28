package com.aima.mapper;

import com.aima.dto.response.AnalyticsContentTypeResponse;
import com.aima.dto.response.AnalyticsHeatmapCellResponse;
import com.aima.dto.response.AnalyticsTopPostResponse;
import com.aima.repository.projection.ContentTypeMetricProjection;
import com.aima.repository.projection.HeatmapCellProjection;
import com.aima.repository.projection.TopPostProjection;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * Ánh xạ projection → DTO cho trang Phân tích. Các DTO thuần số (thẻ KPI, điểm chuỗi, tỷ trọng
 * nền tảng) được dựng trực tiếp trong service (ngoại lệ đã ghi ở DashboardMapper) nên chỉ dòng
 * "Top bài viết" (projection có cả trường entity) đi qua mapper này.
 *
 * <p>{@code platform} (String tên enum trong DB) → {@code Platform} do MapStruct tự dùng valueOf;
 * các trường cùng tên còn lại tự khớp.
 */
@Mapper(componentModel = "spring")
public interface AnalyticsMapper {

    AnalyticsTopPostResponse toTopPostResponse(TopPostProjection projection);

    List<AnalyticsTopPostResponse> toTopPostResponseList(List<TopPostProjection> projections);

    /** Khối F — {@code sharePct} cần tổng của cả kỳ nên service tính và gán sau khi map. */
    @Mapping(target = "sharePct", ignore = true)
    AnalyticsContentTypeResponse toContentTypeResponse(ContentTypeMetricProjection projection);

    List<AnalyticsContentTypeResponse> toContentTypeResponseList(List<ContentTypeMetricProjection> projections);

    /**
     * Khối G — {@code hourStart}/{@code avgEngagement}/{@code lowSample} là giá trị dẫn xuất
     * (từ slot, posts và ngưỡng mẫu tối thiểu) nên service điền sau khi map.
     */
    @Mapping(target = "hourStart", ignore = true)
    @Mapping(target = "avgEngagement", ignore = true)
    @Mapping(target = "lowSample", ignore = true)
    AnalyticsHeatmapCellResponse toHeatmapCell(HeatmapCellProjection projection);

    List<AnalyticsHeatmapCellResponse> toHeatmapCellList(List<HeatmapCellProjection> projections);
}
