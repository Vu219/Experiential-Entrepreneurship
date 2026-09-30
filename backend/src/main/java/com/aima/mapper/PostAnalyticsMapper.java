package com.aima.mapper;

import com.aima.dto.response.AnalyzedPostResponse;
import com.aima.dto.response.PostAnalyticsResponse;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.service.MetaApiClient;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.Instant;
import java.util.List;

/**
 * Mapper cho concern Performance Analysis (FR-59..FR-62): số liệu nền tảng → PostAnalytics,
 * entity → response cho trang Analytics.
 */
@Mapper(componentModel = "spring")
public interface PostAnalyticsMapper {

    // ===== Thu thập (FR-59) =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "ctr", ignore = true)        // MVP: chưa theo dõi link/conversion/watch time
    @Mapping(target = "conversion", ignore = true)
    @Mapping(target = "watchTime", ignore = true)
    @Mapping(target = "optimizationInsights", ignore = true)
    PostAnalytics toAnalytics(Post post, MetaApiClient.MetaPostMetrics metrics,
                              Integer milestoneHours, Instant collectedAt);

    // ===== Entity → response (FR-60/FR-61) =====

    PostAnalyticsResponse toResponse(PostAnalytics analytics);

    List<PostAnalyticsResponse> toResponseList(List<PostAnalytics> analytics);

    @Mapping(target = "accountName", source = "post.schedule.platformAccount.accountName")
    @Mapping(target = "contentItemId", source = "post.schedule.contentVersion.contentItem.id")
    @Mapping(target = "formattedCaption", source = "post.schedule.contentVersion.formattedCaption")
    AnalyzedPostResponse toAnalyzedPostResponse(Post post, List<PostAnalyticsResponse> analytics);
}
