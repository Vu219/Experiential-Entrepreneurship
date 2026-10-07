package com.aima.service.Impl;

import com.aima.enums.MetricsErrorType;
import com.aima.enums.Platform;
import com.aima.exception.MetricsFetchException;
import com.aima.service.PlatformMetricsProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Instagram — STUB: AIMA chưa đăng được bài IG (IG_MEDIA_REQUIRED) nên chưa có gì để thu. Mọi bài trả
 * UNSUPPORTED → job dừng theo dõi bài đó, không gọi Meta.
 */
@Service
public class InstagramMetricsProviderImpl implements PlatformMetricsProvider {

    @Override
    public Platform platform() {
        return Platform.INSTAGRAM;
    }

    @Override
    public List<PostMetricsResult> fetchPostMetrics(String accessToken, List<String> platformMediaIds) {
        // TODO Instagram: /{ig-media-id}/insights?metric=views,reach,likes,comments,shares,saved (mục 2.2).
        return platformMediaIds.stream()
                .map(id -> PostMetricsResult.failed(id, new MetricsFetchException(MetricsErrorType.UNSUPPORTED,
                        "UNSUPPORTED", "Chưa hỗ trợ thu số liệu INSTAGRAM")))
                .toList();
    }

    @Override
    public List<AccountDailyMetrics> fetchAccountMetrics(String accessToken, String platformAccountId,
                                                         LocalDate from, LocalDate to) {
        // TODO Instagram: /{ig-user-id}/insights (views, reach, accounts_engaged, follows_and_unfollows...).
        throw new UnsupportedOperationException("Instagram account insights: chưa hỗ trợ");
    }

    @Override
    public List<PublishedPost> listPublishedPosts(String accessToken, String platformAccountId, Instant since) {
        // TODO Instagram: /{ig-user-id}/media.
        throw new UnsupportedOperationException("Instagram published posts: chưa hỗ trợ");
    }
}
