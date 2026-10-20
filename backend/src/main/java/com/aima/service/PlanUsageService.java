package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlanFeatureUsageResponse;
import com.aima.entity.User;
import com.aima.enums.PlanLimitKey;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Áp giới hạn tính năng theo gói (V18) tại các điểm tạo mới — hạn mức lấy từ {@link PlanLimitService}, số đã dùng
 * đếm từ bảng nguồn trong kỳ subscription hiện tại. Vượt → {@code PlanLimitException} (PLAN_LIMIT_REACHED /
 * PLAN_FEATURE_NOT_INCLUDED). Hạ gói không xoá dữ liệu: chỉ việc TẠO MỚI bị chặn.
 */
public interface PlanUsageService {

    /** Cờ / tính năng phải có trong gói (FLAG bật, hoặc QUOTA/CAP khác 0). */
    void requireIncluded(User user, PlanLimitKey key);

    /**
     * Còn lượt cho một QUOTA. Khoá dòng subscription của user để hai request song song không cùng vượt —
     * gọi TRONG transaction sẽ ghi bản ghi mới.
     *
     * @param scopeId id phạm vi đếm (brandId cho STRATEGIES_PER_BRAND), null với giới hạn cấp tài khoản
     */
    void requireQuota(User user, PlanLimitKey key, UUID scopeId);

    /** Giá trị {@code requested} không vượt trần CAP (vd số ý tưởng / số ngày). */
    void requireCap(User user, PlanLimitKey key, long requested);

    /** Trần hiệu lực của một CAP: null = không giới hạn, 0 = tắt. */
    Long cap(User user, PlanLimitKey key);

    /** Lịch đặt tại {@code scheduledTime} nằm trong số ngày tối đa của gói (SCHEDULE_HORIZON_DAYS). */
    void requireScheduleHorizon(User user, Instant scheduledTime);

    /** Ngày sớm nhất trang Phân tích được xem (ANALYTICS_HISTORY_DAYS); null = không giới hạn. */
    LocalDate analyticsEarliestDate(User user, LocalDate today);

    /** Số kênh còn được kết nối thêm; null = không giới hạn. */
    Long remainingChannels(User user);

    ApiResponse<PlanFeatureUsageResponse> getMyUsage(String email);
}
