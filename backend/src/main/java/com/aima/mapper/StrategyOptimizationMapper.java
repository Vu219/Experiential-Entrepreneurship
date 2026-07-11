package com.aima.mapper;

import com.aima.dto.ai.AnalyzePayload;
import com.aima.dto.ai.AnalyzedPostPayload;
import com.aima.dto.ai.BrandProfileInputPayload;
import com.aima.dto.ai.ContentStrategyInputPayload;
import com.aima.dto.ai.OptimizationInsightPayload;
import com.aima.dto.ai.OptimizePayload;
import com.aima.dto.ai.PostMetricsPayload;
import com.aima.dto.ai.StrategyAdjustmentPayload;
import com.aima.dto.response.StrategyAdjustmentResponse;
import com.aima.dto.response.StrategyOptimizationJobResponse;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.entity.OptimizationInsight;
import com.aima.entity.Post;
import com.aima.entity.PostAnalytics;
import com.aima.entity.StrategyAdjustment;
import com.aima.entity.StrategyOptimizationJob;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

/**
 * Tối ưu chiến lược (FR-63..FR-68): entity → payload gửi AI (/analyze, /optimize) và
 * payload kết quả → entity/response. Một mapper cho concern optimization (như AiContentMapper).
 */
@Mapper(componentModel = "spring")
public interface StrategyOptimizationMapper {

    // ===== Job =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "contentStrategy", source = "strategy")
    @Mapping(target = "status", ignore = true) // giữ default PENDING, không lấy StrategyStatus của strategy
    StrategyOptimizationJob toJob(ContentStrategy strategy);

    @Mapping(target = "futureImprovements", source = "job.futureImprovements", qualifiedByName = "splitLines")
    StrategyOptimizationJobResponse toJobResponse(StrategyOptimizationJob job,
                                                  List<StrategyAdjustmentResponse> adjustments);

    // ===== Entity → payload gửi AI =====

    // saves/ctr/conversion/watch time null trong MVP → NON_NULL trên payload bỏ qua, pydantic dùng default.
    @Mapping(target = "conversionRate", source = "conversion")
    PostMetricsPayload toMetricsPayload(PostAnalytics analytics);

    // hook không tách được từ script đã làm phẳng → bỏ (Optional phía Python).
    @Mapping(target = "postId", source = "post.id")
    @Mapping(target = "platform", source = "post.platformName")
    @Mapping(target = "scheduledHour", expression = "java(post.getSchedule().getScheduledTime() == null ? null : post.getSchedule().getScheduledTime().getHour())")
    @Mapping(target = "hook", ignore = true)
    @Mapping(target = "caption", source = "version.formattedCaption")
    @Mapping(target = "hashtags", source = "version.formattedHashtag", qualifiedByName = "csvToList")
    @Mapping(target = "cta", source = "version.cta")
    @Mapping(target = "mediaFormat", source = "version.mediaFormat")
    @Mapping(target = "metrics", source = "metrics")
    AnalyzedPostPayload toAnalyzedPostPayload(Post post, ContentVersion version, PostAnalytics metrics);

    AnalyzePayload toAnalyzePayload(BrandProfileInputPayload brandProfile, List<AnalyzedPostPayload> posts);

    OptimizePayload toOptimizePayload(BrandProfileInputPayload brandProfile, ContentStrategyInputPayload strategy,
                                      List<OptimizationInsightPayload> insights);

    // ===== Payload kết quả → entity =====

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "analytics", source = "analytics")
    @Mapping(target = "strategyAdjustments", ignore = true)
    OptimizationInsight toInsight(OptimizationInsightPayload payload, PostAnalytics analytics);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "strategy", source = "strategy")
    @Mapping(target = "insight", source = "insight")
    @Mapping(target = "appliedStatus", constant = "PENDING")
    @Mapping(target = "decidedAt", ignore = true)
    StrategyAdjustment toAdjustment(StrategyAdjustmentPayload payload, ContentStrategy strategy,
                                    OptimizationInsight insight);

    // ===== Entity → response =====

    @Mapping(target = "strategyId", source = "strategy.id")
    @Mapping(target = "insightContent", source = "insight.insightContent")
    @Mapping(target = "recommendation", source = "insight.recommendation")
    StrategyAdjustmentResponse toResponse(StrategyAdjustment adjustment);

    List<StrategyAdjustmentResponse> toResponseList(List<StrategyAdjustment> adjustments);

    @Named("csvToList")
    default List<String> csvToList(String csv) {
        return csv == null || csv.isBlank() ? List.of()
                : Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    @Named("splitLines")
    default List<String> splitLines(String lines) {
        return lines == null || lines.isBlank() ? List.of()
                : Stream.of(lines.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
