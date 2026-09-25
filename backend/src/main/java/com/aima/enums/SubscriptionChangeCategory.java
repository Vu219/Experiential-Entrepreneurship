package com.aima.enums;

/**
 * Nhãn phân loại lý do admin thay đổi gói — phục vụ audit/thống kê (vd "đã tặng bao nhiêu ngày
 * dịp sự kiện"). Cố ý KHÔNG thêm vào {@link PlanSource}: enum đó dùng chung với billing/doanh
 * thu, còn đây chỉ là nhãn của từng dòng lịch sử (user chốt 25/9).
 */
public enum SubscriptionChangeCategory {
    /** Khuyến mãi / tặng dịp sự kiện. */
    PROMOTION,
    /** Đền bù sự cố. */
    COMPENSATION,
    /** Hỗ trợ khách hàng (tài khoản nội bộ, thanh toán ngoài hệ thống...). */
    SUPPORT,
    OTHER
}
