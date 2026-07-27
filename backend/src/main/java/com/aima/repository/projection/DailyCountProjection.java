package com.aima.repository.projection;

/**
 * Một số đếm theo NGÀY — nguồn chung cho sparkline 7 ngày của trang Tổng quan quản trị
 * (user mới, nội dung tạo mới, user hoạt động).
 *
 * <p>{@code day} là chuỗi {@code yyyy-MM-dd} do native {@code to_char} sinh ra. Cột timestamp
 * lưu giờ địa phương theo {@code APP_TIMEZONE} nên chuỗi này đã là ngày theo múi giờ ứng dụng,
 * không cần convert thêm.
 */
public interface DailyCountProjection {

    String getDay();

    long getTotal();
}
