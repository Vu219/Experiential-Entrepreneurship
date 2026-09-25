package com.aima.enums;

/**
 * Nguồn gốc gói hiện hành trên {@code subscriptions.plan_source} — trả lời câu hỏi "vì sao
 * user này đang ở gói này", thứ mà chỉ nhìn {@code plan_id} không biết được.
 *
 * <p>Cần cho đối soát và cho audit: một user đang ở gói PRO vì đã TRẢ TIỀN khác hẳn một user
 * đang ở PRO vì admin cấp tay lúc xử lý sự cố. Gói do admin cấp không có dòng {@code payments}
 * tương ứng, nên nếu không ghi lại đây thì báo cáo doanh thu và trạng thái gói sẽ lệch nhau
 * mà không giải thích được.
 */
public enum PlanSource {

    /** Gói miễn phí mặc định — không có hạn dùng ({@code plan_expires_at} null). */
    FREE,

    /** Kích hoạt bởi một đơn {@code payments} đã PAID. Đường đi bình thường của khách trả tiền. */
    PAYMENT,

    /** Admin cấp/gia hạn/thu hồi thủ công. Luôn kèm lý do trong {@code activity_logs}. */
    ADMIN
}
