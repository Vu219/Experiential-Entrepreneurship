package com.aima.repository.projection;

/**
 * Số liệu tối giản của MỘT bài đã đăng trong kỳ, phục vụ dải "Thông tin chi tiết" (khối H):
 * đếm bài trên/dưới mức trung bình kỳ và tính tỷ lệ tương tác.
 *
 * <p>{@code views} để kiểu {@code Long} (KHÔNG {@code long}) một cách CỐ Ý: Facebook chỉ trả lượt
 * xem khi có quyền {@code read_insights} nên giá trị có thể NULL, và "chưa thu được lượt xem" khác
 * hẳn "0 lượt xem" — tỷ lệ tương tác phải loại các bài null ra khỏi mẫu số thay vì coi là 0.
 */
public interface PostEngagementProjection {

    long getEngagement();

    Long getViews();
}
