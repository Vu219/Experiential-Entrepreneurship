package com.aima.mapper;

import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.PreviousTrendPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.ai.TrendPayload;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.ResearchSourceResponse;
import com.aima.dto.response.TrendEvidenceResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.dto.response.TrendResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.Platform;
import com.aima.enums.ResearchTrigger;
import com.aima.enums.SuitabilityLevel;
import com.aima.enums.TrendMomentum;
import com.aima.enums.TrendType;
import com.aima.repository.TrendRepository;
import com.aima.util.JsonColumns;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

@Mapper(componentModel = "spring")
public interface TrendResearchMapper {

    // ===== Entity → response =====

    @Mapping(target = "strategyName", source = "contentStrategy.name")
    @Mapping(target = "dataSources", source = "dataSources", qualifiedByName = "readSources")
    TrendResearchSessionResponse toSessionResponse(TrendResearchSession session);

    @Mapping(target = "hashtags", source = "hashtags", qualifiedByName = "readStrings")
    @Mapping(target = "evidence", source = "evidence", qualifiedByName = "readEvidence")
    TrendResponse toTrendResponse(Trend trend);

    @Mapping(target = "executionSuggestions", source = "executionSuggestions", qualifiedByName = "readStrings")
    @Mapping(target = "relatedGoals", source = "relatedGoals", qualifiedByName = "readStrings")
    ContentIdeaResponse toContentIdeaResponse(ContentIdea idea);

    @Mapping(target = "trendsFound", expression = "java(session.getTrends().size())")
    @Mapping(target = "ideasCreated",
            expression = "java(session.getTrends().stream().mapToInt(tr -> tr.getContentIdeas().size()).sum())")
    TrendResearchSessionSummaryResponse toSessionSummaryResponse(TrendResearchSession session);

    // ===== Create session =====

    // id/audit PHẢI ignore: nếu không MapStruct auto-map brand.id → session.id, JPA save()
    // tưởng entity đã tồn tại → merge → StaleObjectStateException (500 khi bấm Research ngay).
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(target = "brandProfile", source = "brand")
    @Mapping(target = "industry", source = "brand.industry")
    @Mapping(target = "contentStrategy", source = "strategy")
    @Mapping(target = "researchTime", expression = "java(java.time.LocalDateTime.now())")
    @Mapping(target = "status", constant = "PENDING")
    @Mapping(target = "summary", ignore = true)
    @Mapping(target = "errorMessage", ignore = true)
    @Mapping(target = "grounded", ignore = true)
    @Mapping(target = "webSearches", ignore = true)
    @Mapping(target = "dataSources", ignore = true)
    @Mapping(target = "trends", ignore = true)
    TrendResearchSession toSession(BrandProfile brand, Platform platform, ContentStrategy strategy,
                                   Integer articleCount, ResearchTrigger triggerType);

    // Kết quả phiên (tóm tắt + nguồn đã dùng) ghi lên session có sẵn; trends/ideas gắn riêng ở worker.
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "summary", source = "summary")
    @Mapping(target = "grounded", source = "grounded")
    @Mapping(target = "webSearches", source = "webSearches")
    @Mapping(target = "dataSources", source = "sourcesUsed", qualifiedByName = "writeJson")
    void applyResult(ResearchResultPayload result, @MappingTarget TrendResearchSession session);

    // ===== AI result → entities =====

    @Mapping(target = "researchSession", ignore = true)
    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    @Mapping(target = "relevance", source = "relevance", qualifiedByName = "parseLevel")
    @Mapping(target = "confidence", source = "confidence", qualifiedByName = "parseLevel")
    @Mapping(target = "trendType", source = "trendType", qualifiedByName = "parseTrendType")
    @Mapping(target = "momentum", source = "momentum", qualifiedByName = "parseMomentum")
    @Mapping(target = "actBy", source = "actBy", qualifiedByName = "parseDate")
    @Mapping(target = "hashtags", source = "hashtags", qualifiedByName = "writeJson")
    @Mapping(target = "evidence", source = "evidence", qualifiedByName = "writeJson")
    @Mapping(target = "contentIdeas", ignore = true)
    Trend toTrend(TrendPayload payload);

    @Mapping(target = "trend", ignore = true)
    @Mapping(target = "platform", source = "platform", qualifiedByName = "parsePlatform")
    @Mapping(target = "suitabilityLevel", source = "suitabilityLevel", qualifiedByName = "parseSuitability")
    @Mapping(target = "executionSuggestions", source = "executionSuggestions", qualifiedByName = "writeJson")
    @Mapping(target = "relatedGoals", source = "relatedGoals", qualifiedByName = "writeJson")
    @Mapping(target = "contentItems", ignore = true)
    ContentIdea toContentIdea(ContentIdeaPayload payload);

    @Mapping(target = "researchedAt", expression = "java(view.getResearchTime().toLocalDate())")
    @Mapping(target = "rejected", expression = "java(view.getDeletedAt() != null)")
    PreviousTrendPayload toPreviousTrendPayload(TrendRepository.PreviousTrendView view);

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

    /** Mức Low/Medium/High dạng chuỗi bất kỳ hoa/thường → enum; null/lạ → null (khác parseSuitability). */
    @Named("parseLevel")
    default SuitabilityLevel parseLevel(String level) {
        return parseEnum(SuitabilityLevel.class, level);
    }

    @Named("parseTrendType")
    default TrendType parseTrendType(String type) {
        return parseEnum(TrendType.class, type);
    }

    @Named("parseMomentum")
    default TrendMomentum parseMomentum(String momentum) {
        return parseEnum(TrendMomentum.class, momentum);
    }

    @Named("parseDate")
    default LocalDate parseDate(String date) {
        try {
            return date == null || date.isBlank() ? null : LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            return null; // ngày AI trả sai định dạng không làm hỏng cả phiên
        }
    }

    @Named("writeJson")
    default String writeJson(List<?> values) {
        return JsonColumns.write(values);
    }

    @Named("readStrings")
    default List<String> readStrings(String json) {
        return JsonColumns.readList(json, String.class);
    }

    @Named("readEvidence")
    default List<TrendEvidenceResponse> readEvidence(String json) {
        return JsonColumns.readList(json, TrendEvidenceResponse.class);
    }

    @Named("readSources")
    default List<ResearchSourceResponse> readSources(String json) {
        return JsonColumns.readList(json, ResearchSourceResponse.class);
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value) {
        if (value != null) {
            for (E e : type.getEnumConstants()) {
                if (e.name().equalsIgnoreCase(value.trim())) {
                    return e;
                }
            }
        }
        return null;
    }
}
