package com.aima.service;

import com.aima.entity.User;

/**
 * Giới hạn tính năng theo GÓI của user — nơi DUY NHẤT quy đổi cột giới hạn trên {@code plans} thành giới hạn hiệu
 * lực. Gói lấy từ subscription hiện hành (nguồn sự thật, không phải nhãn {@code User.plan}), nên gói admin tự tạo
 * cũng có giới hạn riêng — không còn so tên gói FREE/PLUS/PRO.
 *
 * <p>Quy ước cột trên gói: {@code null} = mặc định hệ thống ({@code aima.ai-assist.*}), {@code -1} = không giới hạn,
 * {@code 0} = tắt, {@code > 0} = số lượt. Hạn mức TOKEN tháng không đi qua đây — {@code TokenUsageService} đọc
 * {@code Plan.monthlyTokenLimit} cùng với kỳ tính usage của subscription.</p>
 */
public interface PlanLimitService {

    /** Giá trị cột gói nghĩa là "không giới hạn". */
    int UNLIMITED = -1;

    /** Giới hạn hiệu lực của user. Gọi trong transaction đang mở (subscription có thể được tạo / lăn kỳ). */
    PlanLimits resolve(User user);

    /** Mặc định hệ thống (đã quy đổi) cho gói chưa cấu hình — trang admin hiển thị để giải thích "Mặc định". */
    PlanLimits defaults();

    /**
     * Giới hạn đã quy đổi: {@code null} = không giới hạn, {@code 0} = tắt, {@code > 0} = số lượt.
     *
     * @param planCode mã gói đã dùng để tính (null = user chưa có gói → mặc định hệ thống)
     */
    record PlanLimits(String planCode, Long policyCheckAiMonthly, Long aiFixPerVersion) {
    }
}
