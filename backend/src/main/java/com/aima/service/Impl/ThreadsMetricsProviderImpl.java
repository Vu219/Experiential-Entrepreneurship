package com.aima.service.Impl;

import com.aima.enums.Platform;
import com.aima.service.MetaApiClient;
import com.aima.service.PlatformMetricsProvider;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Threads — CHƯA thuộc phạm vi đợt này: chỉ giữ nguyên hành vi thu số liệu bài sẵn có
 * ({@code views, likes, replies, reposts+quotes}) để không thoái lui; phần còn lại là stub.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ThreadsMetricsProviderImpl implements PlatformMetricsProvider {

    MetaApiClient metaApiClient;

    @Override
    public Platform platform() {
        return Platform.THREADS;
    }

    @Override
    public List<PostMetricsResult> fetchPostMetrics(String accessToken, List<String> platformMediaIds) {
        // TODO Threads: thêm metric shares, rà lại theo docs/analytics-real-data-plan.md mục 2.3.
        return MetricsFetchSupport.fetchEach(platformMediaIds, mediaId -> {
            MetaApiClient.MetaPostMetrics m = metaApiClient.getPostMetrics(Platform.THREADS, mediaId, accessToken);
            return new PostMetrics(m.views(), null, m.likes(), m.comments(), m.shares(), m.saves(), m.raw());
        });
    }

    @Override
    public List<AccountDailyMetrics> fetchAccountMetrics(String accessToken, String platformAccountId,
                                                         LocalDate from, LocalDate to) {
        // TODO Threads: /{user-id}/threads_insights (views, likes, replies, reposts, quotes, followers_count).
        throw new UnsupportedOperationException("Threads account insights: chưa hỗ trợ");
    }

    @Override
    public List<PublishedPost> listPublishedPosts(String accessToken, String platformAccountId, Instant since) {
        // TODO Threads: /me/threads.
        throw new UnsupportedOperationException("Threads published posts: chưa hỗ trợ");
    }
}
