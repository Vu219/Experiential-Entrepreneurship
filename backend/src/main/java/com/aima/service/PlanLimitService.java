package com.aima.service;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.PlanLimitKey;

import java.util.Map;
import java.util.Set;

/**
 * Giới hạn theo GÓI của user — nơi DUY NHẤT quy đổi cột giới hạn trên {@code plans} (V15 + V18 + V20) thành giới hạn
 * hiệu lực, theo khoá {@link PlanLimitKey}. Gói lấy từ subscription hiện hành (nguồn sự thật, không phải nhãn
 * {@code User.plan}), nên gói admin tự tạo cũng có giới hạn riêng — không so tên gói FREE/PLUS/PRO.
 *
 * <p>Quy ước cột: {@code null} = mặc định hệ thống ({@code aima.plan-limits.defaults.*}, riêng 2 khoá AI đọc
 * {@code aima.ai-assist.*}), {@code -1} = không giới hạn, {@code 0} = tắt, {@code > 0} = hạn mức. <b>Fail-closed:</b>
 * user chưa có subscription và không tra được gói → giới hạn của gói FREE (không bao giờ "không giới hạn" vì thiếu
 * dữ liệu). Hạn mức TOKEN tháng không đi qua đây — {@code TokenUsageService} đọc {@code Plan.monthlyTokenLimit}.</p>
 */
public interface PlanLimitService {

    /** Giá trị cột gói nghĩa là "không giới hạn". */
    int UNLIMITED = -1;

    /**
     * Giới hạn hiệu lực của user — mọi khoá đã quy đổi một lần (một lần đọc subscription). Gọi trong transaction đang
     * mở (subscription có thể được tạo / lăn kỳ / hạ gói hết hạn).
     */
    FeatureLimits features(User user);

    /** Giới hạn hiệu lực của MỘT gói (bảng so sánh tự động, đồng bộ lịch khi gói đổi). {@code null} → gói FREE. */
    FeatureLimits featuresOf(Plan plan);

    /** Mặc định hệ thống (giá trị THÔ theo quy ước cột) — trang admin hiển thị cho ô "Mặc định" của 3 gói lõi. */
    PlanFeatureLimits defaultFeatureLimits();

    /**
     * Giới hạn đã quy đổi. Với QUOTA/CAP: {@code null} = không giới hạn, {@code 0} = tắt, {@code > 0} = hạn mức.
     * Với FLAG: {@code null} = bật, {@code 0} = tắt. Với SET: số nền tảng được phép, tập ở {@code allowedPlatforms}.
     */
    record FeatureLimits(String planCode, Map<PlanLimitKey, Long> values, Set<Platform> allowedPlatforms) {

        public Long limit(PlanLimitKey key) {
            return values.get(key);
        }

        /** Tính năng có trong gói (cờ bật / hạn mức khác 0 / có ít nhất một nền tảng). */
        public boolean included(PlanLimitKey key) {
            Long value = values.get(key);
            return value == null || value != 0L;
        }

        /** Gói cho phép nền tảng (ALLOWED_PLATFORMS). */
        public boolean allows(Platform platform) {
            return allowedPlatforms.contains(platform);
        }
    }
}
