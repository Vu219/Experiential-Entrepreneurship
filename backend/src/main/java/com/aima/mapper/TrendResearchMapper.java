package com.aima.mapper;

import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.TrendPayload;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.dto.response.TrendResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface TrendResearchMapper {

    // ===== Entity → response =====

    TrendResearchSessionResponse toSessionResponse(TrendResearchSession session);

    TrendResponse toTrendResponse(Trend trend);

    ContentIdeaResponse toContentIdeaResponse(ContentIdea idea);

    @Mapping(target = "trendsFound", expression = "java(session.getTrends().size())")
    @Mapping(target = "ideasCreated",
            expression = "java(session.getTrends().stream().mapToInt(tr -> tr.getContentIdeas().size()).sum())")
    TrendResearchSessionSummaryResponse toSessionSummaryResponse(TrendResearchSession session);

    // ===== Create session =====

    @Mapping(target = "brandProfile", source = "brand")
    @Mapping(target = "industry", source = "brand.industry")
    @Mapping(target = "researchTime", expression = "java(java.time.LocalDateTime.now())")
    @Mapping(target = "status", constant = "PENDING")
    TrendResearchSession toSession(BrandProfile brand, Platform platform);

    // ===== AI result → entities =====

    @Mapping(target = "researchSession", ignore = true)
    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    Trend toTrend(TrendPayload payload);

    @Mapping(target = "trend", ignore = true)
    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    @Mapping(target = "suitabilityLevel", source = "suitabilityLevel", qualifiedByName = "parseSuitability")
    ContentIdea toContentIdea(ContentIdeaPayload payload);

    // AI trả tên nền tảng dạng chuỗi ("Facebook"/"Instagram"/"Threads") — chuẩn hoá về enum,
    // giá trị lạ quy về FACEBOOK (scope đầu tiên) thay vì làm hỏng cả phiên.
    @Named("parsePlatform")
    default Platform parsePlatform(String platform) {
        if (platform != null) {
            for (Platform p : Platform.values()) {
                if (p.name().equalsIgnoreCase(platform.trim())) {
                    return p;
                }
            }
        }
        return Platform.FACEBOOK;
    }

    @Named("parseSuitability")
    default SuitabilityLevel parseSuitability(String level) {
        if (level != null) {
            for (SuitabilityLevel s : SuitabilityLevel.values()) {
                if (s.name().equalsIgnoreCase(level.trim())) {
                    return s;
                }
            }
        }
        return SuitabilityLevel.MEDIUM;
    }
}
