package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Số liệu cấp tài khoản/Trang theo ngày (Flyway V8). Ngày theo nền tảng báo (Facebook: giờ Thái Bình Dương).
 * Cột metric đều nullable: null = nền tảng không trả / chưa có quyền / Trang dưới ngưỡng — KHÁC 0.
 * Upsert theo (tài khoản, ngày): Meta sửa số trong ~48 giờ nên mỗi lượt lấy lại vài ngày gần nhất.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "account_insights_daily")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AccountInsightsDaily extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_account_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformAccount platformAccount;

    @Column(name = "metric_date", nullable = false)
    LocalDate metricDate;

    /** Tổng người theo dõi tại ngày đó. */
    @Column(name = "followers_count")
    Long followersCount;

    /** Lượt theo dõi MỚI trong ngày. */
    @Column(name = "follows")
    Long follows;

    @Column(name = "unfollows")
    Long unfollows;

    /** Lượt xem nội dung của Trang trong ngày (FB page_media_view). */
    @Column(name = "views")
    Long views;

    @Column(name = "reach")
    Long reach;

    /** Lượt tương tác với bài của Trang trong ngày (FB page_post_engagements). */
    @Column(name = "interactions")
    Long interactions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw", columnDefinition = "jsonb")
    String raw;

    @Column(name = "collected_at", nullable = false)
    Instant collectedAt;
}
