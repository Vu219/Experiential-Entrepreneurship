package com.aima.mapper;

import com.aima.dto.response.AdminOverviewSummaryResponse.PlanDistributionResponse;
import com.aima.dto.response.AdminOverviewSummaryResponse.RecentUserResponse;
import com.aima.entity.User;
import com.aima.repository.projection.PlanSubscriptionProjection;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Chuyển entity/projection sang DTO cho trang Tổng quan quản trị. Các thẻ KPI là con số thuần
 * tính toán, không có entity nguồn, nên được dựng trực tiếp trong service — cùng cách
 * {@link DashboardMapper} làm cho Bảng điều khiển.
 */
@Mapper(componentModel = "spring")
public interface AdminOverviewMapper {

    // sharePct do service tính (cần tổng của cả danh sách) rồi truyền vào như tham số cùng tên.
    PlanDistributionResponse toPlanDistribution(PlanSubscriptionProjection projection, double sharePct);

    // plan/status là enum → String, MapStruct tự gọi name(). postCount đến từ tham số cùng tên.
    @Mapping(target = "postCount", source = "postCount")
    RecentUserResponse toRecentUser(User user, long postCount);
}
