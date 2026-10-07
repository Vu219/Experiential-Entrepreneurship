package com.aima.service.Impl;

import com.aima.enums.MetricsErrorType;
import com.aima.exception.MetricsFetchException;
import com.aima.service.PlatformMetricsProvider.PostMetrics;
import com.aima.service.PlatformMetricsProvider.PostMetricsResult;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Vòng lặp thu từng bài dùng chung cho các {@code *MetricsProviderImpl}. */
final class MetricsFetchSupport {

    private MetricsFetchSupport() {
    }

    /** Gọi từng bài; RATE_LIMIT / TOKEN_INVALID ảnh hưởng cả tài khoản nên dừng sớm. */
    static List<PostMetricsResult> fetchEach(List<String> platformMediaIds, Function<String, PostMetrics> fetchOne) {
        List<PostMetricsResult> results = new ArrayList<>(platformMediaIds.size());
        for (String mediaId : platformMediaIds) {
            try {
                results.add(PostMetricsResult.ok(mediaId, fetchOne.apply(mediaId)));
            } catch (MetricsFetchException e) {
                results.add(PostMetricsResult.failed(mediaId, e));
                if (e.getErrorType() == MetricsErrorType.RATE_LIMIT || e.getErrorType() == MetricsErrorType.TOKEN_INVALID) {
                    break;
                }
            }
        }
        return results;
    }
}
