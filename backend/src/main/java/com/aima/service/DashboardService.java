package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DashboardPerformanceResponse;
import com.aima.dto.response.DashboardSummaryResponse;

import java.time.LocalDate;

public interface DashboardService {

    /**
     * Toàn bộ số liệu tab "Bảng điều khiển" của user đang đăng nhập trong một lần gọi.
     *
     * @param email email lấy từ access token (định danh user, API-03/SEC-04)
     * @param days  độ dài khoảng xem của biểu đồ hiệu suất; FE gửi 7 hoặc 30, giá trị ngoài
     *              khoảng hợp lệ được kẹp lại thay vì báo lỗi
     */
    ApiResponse<DashboardSummaryResponse> getSummary(String email, int days);

    /**
     * Biểu đồ "Hiệu quả nội dung" theo khoảng ngày tùy chọn (nút Bộ lọc trên Bảng điều khiển).
     *
     * @param from ngày bắt đầu (null = 6 ngày trước {@code to}); sớm hơn mốc lịch sử của gói thì bị kẹp
     * @param to   ngày kết thúc (null hoặc sau hôm nay = hôm nay)
     */
    ApiResponse<DashboardPerformanceResponse> getPerformance(String email, LocalDate from, LocalDate to);
}
