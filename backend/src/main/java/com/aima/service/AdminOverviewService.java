package com.aima.service;

import com.aima.dto.response.AdminOverviewSummaryResponse;
import com.aima.dto.response.ApiResponse;

/**
 * UI-10 — số liệu gộp cho trang Quản trị → Tổng quan (ADMIN). Chỉ ĐỌC và GỘP dữ liệu thật;
 * không có thao tác ghi nào ở đây.
 */
public interface AdminOverviewService {

    /** Số dòng của bảng "Người dùng gần đây" — trần cứng để một tham số lạ không quét cả bảng. */
    int MAX_RECENT_USERS = 20;

    /** 4 thẻ KPI + phân bổ gói + người dùng gần đây. {@code limit} ngoài khoảng sẽ bị kẹp, không báo lỗi. */
    ApiResponse<AdminOverviewSummaryResponse> getSummary(int recentUsersLimit);
}
