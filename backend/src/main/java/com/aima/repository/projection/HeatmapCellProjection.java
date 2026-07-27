package com.aima.repository.projection;

/**
 * Một ô của heatmap "Thời điểm hoạt động nhiều nhất" (khối G): gộp theo (thứ, khung 3 giờ) của
 * {@code posts.published_at} — giờ đã theo múi giờ ứng dụng ({@code APP_TIMEZONE}, mặc định
 * Asia/Ho_Chi_Minh) nên không cần quy đổi thêm.
 *
 * <p>{@code dow} theo ISO: 1 = Thứ 2 … 7 = Chủ nhật. {@code slot} = 0..7 (0 = 00:00–02:59,
 * 7 = 21:00–23:59). Chỉ ô CÓ bài mới xuất hiện — service/FE tự điền 0 cho ô còn lại, vì "chưa từng
 * đăng" khác hẳn "đăng mà không ai tương tác".
 */
public interface HeatmapCellProjection {

    int getDow();

    int getSlot();

    long getPosts();

    long getEngagement();
}
