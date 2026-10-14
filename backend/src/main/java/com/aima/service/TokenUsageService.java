package com.aima.service;

import java.util.UUID;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TokenUsageResponse;
import com.aima.entity.User;

/**
 * Hạn mức token LLM theo kỳ (nguồn hạn mức DUY NHẤT: Plan.monthlyTokenLimit — FREE 1.000 /
 * PLUS 100.000 / PRO 1.000.000; kỳ đọc từ Subscription, hiện là tháng lịch). Mức dùng đo từ
 * EVENT LOG {@code ai_usage} (trừ GRANT / sau mốc RESET của {@code usage_adjustments}) —
 * {@code users.tokens_used} chỉ còn là cache enforcement, dựng lại được qua reconcile.
 */
public interface TokenUsageService {

    /** GET /users/me/token-usage — mức dùng/hạn mức kỳ này cho thanh usage ở sidebar. */
    ApiResponse<TokenUsageResponse> getMyUsage(String email);

    /** Đo mức dùng hiệu lực của kỳ hiện tại — KHÔNG chặn (trang usage vẫn xem được khi vượt). */
    QuotaState state(User user);

    /**
     * Chặn tác vụ AI mới khi user đã dùng hết hạn mức kỳ (TOKEN_QUOTA_EXCEEDED — chặn cứng
     * 100%; admin GRANT token mở lại tức thì). Trả QuotaState để caller phát cảnh báo 80%.
     */
    QuotaState checkQuota(User user);

    /** Số tác vụ AI (tạo + định dạng + tạo lại) PENDING/RUNNING tối đa của một user cùng lúc. */
    int MAX_CONCURRENT_AI_JOBS = 3;

    /**
     * Chặn tác vụ AI mới khi user đã có {@link #MAX_CONCURRENT_AI_JOBS} job đang chạy
     * (AI_JOBS_LIMIT_REACHED). {@link #checkQuota} chỉ đọc mức đã dùng nên N job khởi động cùng lúc
     * đều lọt và cùng vượt hạn mức — giới hạn này chặn trên phần vượt đó.
     */
    void checkConcurrentAiJobs(User user);

    /**
     * Cộng đơn vị quy đổi vào cache users.tokens_used; gọi trong transaction đang mở.
     * Từ pha 2: nguồn gọi DUY NHẤT là AiUsageServiceImpl.saveEvent với lượng
     * billable − credit (đơn vị TRỪ HẠN MỨC GÓI, không phải token thô).
     */
    void record(User user, Long tokens);

    /**
     * Mức dùng hạn mức GÓI của kỳ ({@code used} = planUsed đã trừ credit/GRANT; {@code limit}
     * null = không giới hạn) + {@code creditLeft} = token mua thêm còn lại (bucket riêng,
     * không reset theo kỳ).
     */
    /**
     * Sau khi ghi một event usage: đẩy {@code usage.updated} (thanh token ở sidebar) và báo MỘT lần mỗi kỳ khi vượt
     * 80% ({@code AI_QUOTA_WARNING}) / 100% ({@code AI_QUOTA_EXHAUSTED}) hạn mức gói. Gọi trong transaction. Best-effort.
     */
    void notifyQuotaThresholds(UUID userId);

    record QuotaState(long used, Long limit, long creditLeft) {

        /**
         * Cảnh báo 80% hạn mức gói — CHỈ khi không còn credit; còn credit thì FE hiển thị
         * thông điệp "sắp chuyển sang dùng token đã mua" (dựa creditLeft) thay vì cảnh báo.
         */
        public boolean warn() {
            return limit != null && limit > 0 && used * 100 >= limit * 80 && creditLeft <= 0;
        }

        /** Điểm chặn cứng: hết hạn mức gói VÀ hết token mua thêm. */
        public boolean exceeded() {
            return limit != null && used >= limit && creditLeft <= 0;
        }
    }
}
