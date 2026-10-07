package com.aima.mapper;

import com.aima.dto.response.AnalyzedPostResponse;
import com.aima.dto.response.PostAnalyticsResponse;
import com.aima.entity.AccountInsightsDaily;
import com.aima.entity.AccountSyncState;
import com.aima.entity.MetaWebhookEvent;
import com.aima.entity.PlatformAccount;
import com.aima.entity.PlatformMedia;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.PostMetricSnapshot;
import com.aima.entity.PostMetricsDaily;
import com.aima.enums.MetricSource;
import com.aima.service.PlatformMetricsProvider;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Mapper cho concern Performance Analysis (FR-59..FR-62): số liệu nền tảng → snapshot / số theo ngày /
 * mốc PostAnalytics, entity → response cho trang Analytics.
 */
@Mapper(componentModel = "spring")
public interface PostAnalyticsMapper {

    // ===== Thu thập (FR-59) =====

    /** Mốc 24/48/168h tính từ snapshot đầu tiên sau mốc (không gọi API riêng). likes = reactions. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "post", source = "post")
    @Mapping(target = "views", source = "snapshot.views")
    @Mapping(target = "likes", source = "snapshot.reactions")
    @Mapping(target = "comments", source = "snapshot.comments")
    @Mapping(target = "shares", source = "snapshot.shares")
    @Mapping(target = "saves", source = "snapshot.saves")
    @Mapping(target = "collectedAt", source = "snapshot.collectedAt")
    @Mapping(target = "ctr", ignore = true)        // MVP: chưa theo dõi link/conversion/watch time
    @Mapping(target = "conversion", ignore = true)
    @Mapping(target = "watchTime", ignore = true)
    @Mapping(target = "optimizationInsights", ignore = true)
    PostAnalytics toAnalytics(Post post, PostMetricSnapshot snapshot, Integer milestoneHours);

    /** Bài AIMA vừa thu số liệu lần đầu → dòng theo dõi trên nền tảng (trạng thái đồng bộ giữ mặc định ACTIVE). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "platformAccount", source = "schedule.platformAccount")
    @Mapping(target = "platformMediaId", source = "platformPostId")
    @Mapping(target = "post", source = "post")
    @Mapping(target = "origin", constant = "AIMA")
    @Mapping(target = "platformStatus", ignore = true)
    @Mapping(target = "syncStatus", ignore = true)
    @Mapping(target = "nextSyncAt", ignore = true)
    @Mapping(target = "lastSyncedAt", ignore = true)
    @Mapping(target = "consecutiveFailures", ignore = true)
    @Mapping(target = "lastErrorCode", ignore = true)
    @Mapping(target = "lastErrorAt", ignore = true)
    @Mapping(target = "mediaType", ignore = true)       // nền tảng báo khi quét danh sách bài (chưa có = TEXT trong SQL)
    @Mapping(target = "permalink", ignore = true)       // điền khi quét danh sách bài của Trang
    @Mapping(target = "captionExcerpt", ignore = true)
    PlatformMedia toPlatformMedia(Post post);

    /** Bài người dùng tự đăng ngoài AIMA (đọc từ danh sách bài của Trang) → dòng theo dõi origin = EXTERNAL. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "platformAccount", source = "platformAccount")
    @Mapping(target = "platformName", source = "platformAccount.platformName")
    @Mapping(target = "platformMediaId", source = "published.platformMediaId")
    @Mapping(target = "publishedAt", source = "published.publishedAt")
    @Mapping(target = "post", ignore = true)
    @Mapping(target = "origin", constant = "EXTERNAL")
    @Mapping(target = "platformStatus", ignore = true)
    @Mapping(target = "syncStatus", ignore = true)
    @Mapping(target = "nextSyncAt", ignore = true)
    @Mapping(target = "lastSyncedAt", ignore = true)
    @Mapping(target = "consecutiveFailures", ignore = true)
    @Mapping(target = "lastErrorCode", ignore = true)
    @Mapping(target = "lastErrorAt", ignore = true)
    PlatformMedia toExternalMedia(PlatformAccount platformAccount, PlatformMetricsProvider.PublishedPost published);

    /** Bổ sung đường dẫn / loại nội dung / trích caption cho bài đã theo dõi; giá trị null không ghi đè. */
    @BeanMapping(ignoreByDefault = true, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "permalink", source = "permalink")
    @Mapping(target = "mediaType", source = "mediaType")
    @Mapping(target = "captionExcerpt", source = "captionExcerpt")
    void updateMediaDetails(PlatformMetricsProvider.PublishedPost published, @MappingTarget PlatformMedia media);

    /** Dòng trạng thái đồng bộ cấp tài khoản mới (chưa có lịch / lỗi). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "nextSyncAt", ignore = true)
    @Mapping(target = "lastSyncedAt", ignore = true)
    @Mapping(target = "consecutiveFailures", ignore = true)
    @Mapping(target = "postsErrorCode", ignore = true)
    @Mapping(target = "insightsErrorCode", ignore = true)
    @Mapping(target = "lastErrorAt", ignore = true)
    @Mapping(target = "instagramLinkStatus", ignore = true)
    @Mapping(target = "webhookSubscribedAt", ignore = true)
    @Mapping(target = "webhookErrorCode", ignore = true)
    @Mapping(target = "platformAccount", source = "platformAccount")
    AccountSyncState toSyncState(PlatformAccount platformAccount);

    /** Một ngày insights cấp tài khoản từ adapter nền tảng. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "platformAccount", source = "platformAccount")
    @Mapping(target = "metricDate", source = "metrics.date")
    @Mapping(target = "followersCount", source = "metrics.followers")
    AccountInsightsDaily toAccountInsights(PlatformAccount platformAccount,
                                           PlatformMetricsProvider.AccountDailyMetrics metrics, Instant collectedAt);

    /** Cập nhật ngày đã có (Meta sửa số trong ~48h); metric lần này không trả (null) thì giữ số cũ. */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "platformAccount", ignore = true)
    @Mapping(target = "metricDate", ignore = true)
    @Mapping(target = "followersCount", source = "metrics.followers")
    void updateAccountInsights(PlatformMetricsProvider.AccountDailyMetrics metrics, Instant collectedAt,
                               @MappingTarget AccountInsightsDaily row);

    /** Số liệu chuẩn hoá từ adapter nền tảng → snapshot tích luỹ. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    PostMetricSnapshot toSnapshot(PlatformMedia platformMedia, PlatformMetricsProvider.PostMetrics metrics,
                                  Instant collectedAt, MetricSource source);

    /** Mốc cũ trong post_analytics → snapshot BACKFILL (likes cũ = reactions). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "platformMedia", source = "platformMedia")
    @Mapping(target = "views", source = "analytics.views")
    @Mapping(target = "reactions", source = "analytics.likes")
    @Mapping(target = "comments", source = "analytics.comments")
    @Mapping(target = "shares", source = "analytics.shares")
    @Mapping(target = "saves", source = "analytics.saves")
    @Mapping(target = "collectedAt", source = "analytics.collectedAt")
    @Mapping(target = "reach", ignore = true)
    @Mapping(target = "raw", ignore = true)
    @Mapping(target = "source", constant = "BACKFILL")
    PostMetricSnapshot toBackfillSnapshot(PlatformMedia platformMedia, PostAnalytics analytics);

    /** Dòng số-theo-ngày rỗng; delta do AnalyticsSyncService điền. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "viewsDelta", ignore = true)
    @Mapping(target = "reactionsDelta", ignore = true)
    @Mapping(target = "commentsDelta", ignore = true)
    @Mapping(target = "sharesDelta", ignore = true)
    @Mapping(target = "savesDelta", ignore = true)
    @Mapping(target = "estimated", ignore = true)
    PostMetricsDaily toDaily(PlatformMedia platformMedia, LocalDate metricDate);

    /** Một thay đổi webhook Meta vừa nhận → dòng PENDING chờ worker xử lý (giai đoạn 3). */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "attempts", ignore = true)
    @Mapping(target = "lastError", ignore = true)
    @Mapping(target = "processedAt", ignore = true)
    MetaWebhookEvent toWebhookEvent(String dedupeKey, String pageId, String field, String item, String verb,
                                    String platformPostId, String payload, Instant eventTime);

    // ===== Entity → response (FR-60/FR-61) =====

    PostAnalyticsResponse toResponse(PostAnalytics analytics);

    List<PostAnalyticsResponse> toResponseList(List<PostAnalytics> analytics);

    @Mapping(target = "accountName", source = "post.schedule.platformAccount.accountName")
    @Mapping(target = "contentItemId", source = "post.schedule.contentVersion.contentItem.id")
    @Mapping(target = "formattedCaption", source = "post.schedule.contentVersion.formattedCaption")
    AnalyzedPostResponse toAnalyzedPostResponse(Post post, List<PostAnalyticsResponse> analytics);
}
