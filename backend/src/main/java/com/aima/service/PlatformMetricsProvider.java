package com.aima.service;

import com.aima.enums.Platform;
import com.aima.exception.MetricsFetchException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Adapter thu số liệu của MỘT nền tảng (NFR-09, docs/analytics-real-data-plan.md mục D): job đồng bộ giữ
 * {@code Map<Platform, PlatformMetricsProvider>} — thêm nền tảng = thêm bean, job không đổi. Mọi HTTP vẫn
 * đi qua {@link MetaApiClient} (rule #25). Số liệu trả về đã CHUẨN HOÁ về các cột dùng chung; metric riêng
 * của nền tảng nằm trong {@code raw}.
 */
public interface PlatformMetricsProvider {

    Platform platform();

    /**
     * Số liệu TÍCH LUỸ của các bài. Kết quả theo từng bài — lỗi một bài không làm hỏng bài khác. Gặp
     * RATE_LIMIT hoặc TOKEN_INVALID thì dừng sớm: các bài chưa thử KHÔNG có trong kết quả (lượt sau thử lại).
     */
    List<PostMetricsResult> fetchPostMetrics(String accessToken, List<String> platformMediaIds);

    /**
     * Nền tảng đã hỗ trợ đồng bộ CẤP TÀI KHOẢN ({@link #fetchAccountMetrics} + {@link #listPublishedPosts}) chưa.
     * false → job đồng bộ tài khoản bỏ qua nền tảng này (hai hàm kia là stub).
     */
    default boolean supportsAccountSync() {
        return false;
    }

    /**
     * Insights cấp tài khoản/Trang theo ngày trong [{@code from}, {@code to}] (giai đoạn 2). Ngày hôm nay
     * ({@code to}) mang thêm tổng người theo dõi hiện tại. Lỗi ném {@link MetricsFetchException}.
     */
    List<AccountDailyMetrics> fetchAccountMetrics(String accessToken, String platformAccountId,
                                                  LocalDate from, LocalDate to);

    /**
     * Bài đã đăng trên nền tảng từ {@code since}, kể cả bài người dùng tự đăng ngoài AIMA (giai đoạn 2).
     * Lỗi ném {@link MetricsFetchException}.
     */
    List<PublishedPost> listPublishedPosts(String accessToken, String platformAccountId, Instant since);

    /** Cột dùng chung; null = nền tảng không cung cấp / chưa có quyền (khác 0). */
    record PostMetrics(Long views, Long reach, Long reactions, Long comments, Long shares, Long saves, String raw) {
    }

    /** Đúng một trong hai: {@code metrics} (thành công) hoặc {@code error}. */
    record PostMetricsResult(String platformMediaId, PostMetrics metrics, MetricsFetchException error) {
        public static PostMetricsResult ok(String platformMediaId, PostMetrics metrics) {
            return new PostMetricsResult(platformMediaId, metrics, null);
        }

        public static PostMetricsResult failed(String platformMediaId, MetricsFetchException error) {
            return new PostMetricsResult(platformMediaId, null, error);
        }
    }

    /** Một ngày số liệu cấp tài khoản; cột null = nền tảng không trả (khác 0). */
    record AccountDailyMetrics(LocalDate date, Long followers, Long follows, Long unfollows, Long views, Long reach,
                               Long interactions, String raw) {
    }

    /** {@code mediaType} đã chuẩn hoá IMAGE/VIDEO/TEXT/OTHER (null = không biết). */
    record PublishedPost(String platformMediaId, Instant publishedAt, String permalink, String mediaType,
                         String captionExcerpt) {
    }
}
