package com.aima.repository.projection;

import java.util.UUID;

/**
 * Số người đăng ký + thông tin giá của MỘT gói, gộp ở tầng DB. Một truy vấn nuôi cả hai khối
 * của trang Tổng quan quản trị: card "Phân bổ gói" (userCount) và thẻ KPI "Doanh thu định kỳ
 * tháng" (price / billingIntervalMonths × userCount).
 */
public interface PlanSubscriptionProjection {

    UUID getPlanId();

    String getCode();

    String getNameVi();

    String getNameEn();

    /** Giá VND cho TRỌN chu kỳ, chưa quy về tháng. */
    long getPrice();

    /** Số tháng của một chu kỳ — mẫu số khi quy giá về doanh thu định kỳ tháng. */
    short getBillingIntervalMonths();

    int getDisplayOrder();

    long getUserCount();
}
