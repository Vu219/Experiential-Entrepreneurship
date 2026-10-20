package com.aima.entity;

import com.aima.enums.TrendScheduleFrequency;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Lịch nghiên cứu xu hướng tự động của MỘT user (V19) — trước đây chỉ ở localStorage. User chưa có dòng = mặc định
 * (02:00 hằng ngày, hồ sơ đang hoạt động); {@code enabled = false} = tắt. {@code DailyTrendResearchJob} chạy mỗi giờ
 * và chọn lịch đến giờ ({@link #runTime} theo giờ ứng dụng, phút bị bỏ qua).
 */
@Entity
@Table(name = "trend_research_schedules")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrendResearchSchedule extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Column(name = "enabled", nullable = false)
    Boolean enabled;

    /** Hồ sơ nghiên cứu; null (bị xoá) = hồ sơ đang hoạt động. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_profile_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    BrandProfile brandProfile;

    /** Chiến lược ưu tiên; null / không còn ACTIVE = chiến lược ACTIVE mới nhất của hồ sơ. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_strategy_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentStrategy contentStrategy;

    /** Tên enum Platform, CSV — phiên dùng nền tảng đầu tiên theo thứ tự scope (một phiên / lượt). */
    @Column(name = "platforms", nullable = false, length = 100)
    String platforms;

    @Enumerated(EnumType.STRING)
    @Column(name = "frequency", nullable = false, length = 10)
    TrendScheduleFrequency frequency;

    /** WEEKLY: các thứ chạy, CSV 0 = Thứ Hai … 6 = Chủ nhật. */
    @Column(name = "days", length = 20)
    String days;

    @Column(name = "run_time", nullable = false)
    LocalTime runTime;

    /** Lượt tự động gần nhất — chặn chạy hai lần trong cùng ngày. */
    @Column(name = "last_run_at")
    LocalDateTime lastRunAt;
}
