package com.aima.service.Impl;

import com.aima.enums.MetricsErrorType;
import com.aima.enums.Platform;
import com.aima.exception.MetricsFetchException;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformMetricsProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;

/**
 * Facebook Page: reactions (mọi cảm xúc) / bình luận (cả phản hồi) / chia sẻ + lượt xem {@code post_media_view}
 * (cần read_insights). Gọi từng bài — Batch API là tối ưu để sau, chữ ký theo danh sách đã sẵn cho việc đó.
 * Cấp Trang (giai đoạn 2): danh sách bài đã đăng (import bài ngoài AIMA) + insights theo ngày + tổng người theo dõi.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class FacebookMetricsProviderImpl implements PlatformMetricsProvider {

    static final int CAPTION_EXCERPT_MAX = 300;

    // Tên metric insights Trang → cột dùng chung của AccountDailyMetrics.
    static final String FOLLOWS = "page_daily_follows_unique";
    static final String UNFOLLOWS = "page_daily_unfollows_unique";
    static final String FOLLOWERS = "page_follows";
    static final String VIEWS = "page_media_view";
    static final String INTERACTIONS = "page_post_engagements";

    MetaApiClient metaApiClient;
    ObjectMapper objectMapper;

    @Override
    public Platform platform() {
        return Platform.FACEBOOK;
    }

    @Override
    public boolean supportsAccountSync() {
        return true;
    }

    @Override
    public List<PostMetricsResult> fetchPostMetrics(String accessToken, List<String> platformMediaIds) {
        return MetricsFetchSupport.fetchEach(platformMediaIds, mediaId -> {
            MetaApiClient.MetaPostMetrics m = metaApiClient.getPostMetrics(Platform.FACEBOOK, mediaId, accessToken);
            // reach (post_total_media_view_unique) chưa lấy: metric mới, chưa kiểm chứng — gộp chung lời gọi
            // insights mà Meta từ chối thì mất luôn lượt xem.
            return new PostMetrics(m.views(), null, m.likes(), m.comments(), m.shares(), m.saves(), m.raw());
        });
    }

    /**
     * Insights theo ngày của Trang + tổng người theo dõi hiện tại gắn vào ngày {@code to}. Trang dưới ngưỡng của
     * Meta (~100 lượt thích) có thể không có số theo ngày — khi đó chỉ còn dòng tổng người theo dõi.
     */
    @Override
    public List<AccountDailyMetrics> fetchAccountMetrics(String accessToken, String platformAccountId,
                                                         LocalDate from, LocalDate to) {
        Long followersNow = followersCount(accessToken, platformAccountId);
        Map<String, Map<LocalDate, Long>> values =
                metaApiClient.getPageInsights(platformAccountId, accessToken, from, to).values();

        SortedSet<LocalDate> days = new TreeSet<>();
        values.values().forEach(byDay -> days.addAll(byDay.keySet()));
        // Meta có thể trả thêm một điểm SAU ngày cuối được hỏi (toàn 0) — bỏ, nếu không "ngày mới nhất" thành số 0 giả.
        days.removeIf(day -> day.isAfter(to));
        if (followersNow != null) {
            days.add(to);
        }
        List<AccountDailyMetrics> result = new ArrayList<>(days.size());
        for (LocalDate day : days) {
            ObjectNode raw = objectMapper.createObjectNode();
            values.forEach((metric, byDay) -> {
                Long value = byDay.get(day);
                if (value != null) {
                    raw.put(metric, value);
                }
            });
            Long followers = value(values, FOLLOWERS, day);
            if (day.equals(to) && followersNow != null) {
                followers = followersNow;
                raw.put("followers_count", followersNow);
            }
            result.add(new AccountDailyMetrics(day, followers, value(values, FOLLOWS, day),
                    value(values, UNFOLLOWS, day), value(values, VIEWS, day), null,
                    value(values, INTERACTIONS, day), raw.toString()));
        }
        return result;
    }

    // Chỉ cần pages_read_engagement. Lỗi ảnh hưởng cả tài khoản (rate limit / token) ném ra; lỗi khác → null.
    private Long followersCount(String accessToken, String pageId) {
        try {
            return metaApiClient.getPageFollowersCount(pageId, accessToken);
        } catch (MetricsFetchException e) {
            if (e.getErrorType() == MetricsErrorType.RATE_LIMIT || e.getErrorType() == MetricsErrorType.TOKEN_INVALID) {
                throw e;
            }
            log.warn("[FacebookMetrics] Không đọc được số người theo dõi Trang {} ({}): {}", pageId,
                    e.getResponseCode(), e.getMessage());
            return null;
        }
    }

    private static Long value(Map<String, Map<LocalDate, Long>> values, String metric, LocalDate day) {
        Map<LocalDate, Long> byDay = values.get(metric);
        return byDay == null ? null : byDay.get(day);
    }

    @Override
    public List<PublishedPost> listPublishedPosts(String accessToken, String platformAccountId, Instant since) {
        return metaApiClient.getPagePublishedPosts(platformAccountId, accessToken, since).stream()
                .map(p -> new PublishedPost(p.id(), p.createdTime(), p.permalinkUrl(), mediaType(p),
                        excerpt(p.message())))
                .toList();
    }

    /**
     * attachments.media_type của Graph → nhãn loại nội dung dùng chung; không đính kèm = bài chữ. Video trên Trang
     * thường trả {@code video_inline}/{@code video_autoplay} chứ không phải {@code video} trơn.
     */
    static String mediaType(MetaApiClient.MetaPublishedPost post) {
        if (!post.attachmentTypeKnown()) {
            return null;
        }
        if (post.attachmentType() == null) {
            return "TEXT";
        }
        String type = post.attachmentType().toLowerCase();
        if (type.startsWith("video")) {
            return "VIDEO";
        }
        return switch (type) {
            case "photo", "album" -> "IMAGE";
            default -> "OTHER";
        };
    }

    static String excerpt(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String text = message.strip();
        if (text.length() <= CAPTION_EXCERPT_MAX) {
            return text;
        }
        int end = CAPTION_EXCERPT_MAX - 1;
        if (Character.isHighSurrogate(text.charAt(end - 1))) {
            end--; // không cắt đôi emoji
        }
        return text.substring(0, end) + "…";
    }
}
