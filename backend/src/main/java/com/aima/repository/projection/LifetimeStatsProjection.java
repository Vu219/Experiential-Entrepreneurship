package com.aima.repository.projection;

/**
 * Số liệu TÍCH LŨY (không giới hạn khoảng ngày) của một người dùng — nguồn cho hai ô số trên
 * card hồ sơ: số bài đã đăng và tổng lượt tiếp cận.
 *
 * <p>Khác các projection còn lại của trang Phân tích: những cái kia đều bị chặn trong một
 * khoảng ngày (tối đa 366 ngày), còn hai con số này là tổng từ trước tới nay nên phải có
 * truy vấn riêng chứ không tái dùng được API khoảng ngày.
 */
public interface LifetimeStatsProjection {

    /** Số bài ở trạng thái POSTED của user (đã trừ bài xóa mềm). */
    long getPostsPublished();

    /** Tổng lượt xem, mỗi bài chỉ lấy snapshot mốc MUỘN NHẤT — xem javadoc truy vấn. */
    long getTotalReach();
}
