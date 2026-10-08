package com.aima.mapper;

import com.aima.dto.ai.BrandProfileInputPayload;
import com.aima.dto.ai.ContentIdeaPayload;
import com.aima.dto.ai.ContentStrategyInputPayload;
import com.aima.dto.ai.EvidencePayload;
import com.aima.dto.ai.TrendPayload;
import com.aima.dto.ai.VideoScriptPayload;
import com.aima.dto.common.VideoScriptDto;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import com.aima.util.JsonColumns;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface AiContentMapper {

    // brandName/industry/description/brandVoice/targetAudience auto-map (cùng tên, String→String);
    // brandKeywords/brandDos/brandDonts auto-map (List<String>) — guardrails cho prompt AI.
    @Mapping(target = "contentGoals", source = "contentGoal", qualifiedByName = "wrapContentGoal")
    @Mapping(target = "platforms", source = "platforms", qualifiedByName = "platformsToNames")
    BrandProfileInputPayload toBrandProfilePayload(BrandProfile brand);

    // goals/contentTypes auto-map (List<String>); phần còn lại cần biến đổi.
    @Mapping(target = "frequency", expression = "java(strategy.getFrequencyCount() + \"/\" + strategy.getFrequencyUnit())")
    @Mapping(target = "platforms", source = "platforms", qualifiedByName = "platformsToNames")
    @Mapping(target = "audience", source = "targetAudience", qualifiedByName = "joinComma")
    @Mapping(target = "contentStyle", source = "contentStyle", qualifiedByName = "joinComma")
    @Mapping(target = "ctaType", source = "ctaTypes", qualifiedByName = "joinComma")
    ContentStrategyInputPayload toStrategyPayload(ContentStrategy strategy);

    // Script hiện tại (đã parse từ JSON) → payload gửi AI làm ngữ cảnh khi tạo lại từng phần.
    // hook/cta (ScriptSectionDto→ScriptSectionPayload) và steps (ScriptStepDto→ScriptStepPayload)
    // auto-map nhờ trùng tên field (content/sceneSuggestion/timing, index).
    VideoScriptPayload toVideoScriptPayload(VideoScriptDto script);

    // ===== Trend/idea entity → payload gửi Python (ai/src/schemas.py yêu cầu
    // relevance/relevance_score/description/suitability_level NON-NULL, list không được null) =====

    @Mapping(target = "platform", source = "platform", qualifiedByName = "platformName")
    @Mapping(target = "relevance", source = "relevanceScore", qualifiedByName = "relevanceLevel")
    @Mapping(target = "relevanceScore", source = "relevanceScore", qualifiedByName = "safeScore")
    @Mapping(target = "description", source = "description", qualifiedByName = "emptyIfNull")
    @Mapping(target = "hashtags", source = "hashtags", qualifiedByName = "jsonStrings")
    @Mapping(target = "evidence", source = "evidence", qualifiedByName = "jsonEvidence")
    @Mapping(target = "actBy", expression = "java(trend.getActBy() != null ? trend.getActBy().toString() : null)")
    // Enum phía Python viết hoa chữ đầu ("Niche"/"Rising"/"High") — không gửi để tránh 422; ngữ cảnh
    // tạo nội dung chỉ cần tên/mô tả/hashtag/nguồn.
    @Mapping(target = "trendType", ignore = true)
    @Mapping(target = "momentum", ignore = true)
    @Mapping(target = "confidence", ignore = true)
    TrendPayload toTrendPayload(Trend trend);

    // Danh sách lưu dạng JSON (null → list rỗng: Python mặc định [], gửi null sẽ fail validation pydantic).
    @Mapping(target = "trendName", source = "trend.trendName")
    @Mapping(target = "platform", source = "platform", qualifiedByName = "platformName")
    @Mapping(target = "suitabilityLevel", source = "suitabilityLevel", qualifiedByName = "suitabilityName")
    @Mapping(target = "ideaDescription", source = "ideaDescription", qualifiedByName = "emptyIfNull")
    @Mapping(target = "executionSuggestions", source = "executionSuggestions", qualifiedByName = "jsonStrings")
    @Mapping(target = "relatedGoals", source = "relatedGoals", qualifiedByName = "jsonStrings")
    ContentIdeaPayload toContentIdeaPayload(ContentIdea idea);

    @Named("jsonStrings")
    default List<String> jsonStrings(String json) {
        return JsonColumns.readList(json, String.class);
    }

    @Named("jsonEvidence")
    default List<EvidencePayload> jsonEvidence(String json) {
        return JsonColumns.readList(json, EvidencePayload.class);
    }

    @Named("wrapContentGoal")
    default List<String> wrapContentGoal(String contentGoal) {
        return StringUtils.hasText(contentGoal) ? List.of(contentGoal) : List.of();
    }

    @Named("platformsToNames")
    default List<String> platformsToNames(Collection<Platform> platforms) {
        return platforms == null ? List.of()
                : platforms.stream().map(Enum::name).collect(Collectors.toList());
    }

    @Named("joinComma")
    default String joinComma(List<String> values) {
        return values == null ? null : String.join(", ", values);
    }

    @Named("platformName")
    default String platformName(Platform platform) {
        return platform == null ? null : platform.name();
    }

    // Entity chỉ lưu score (mức High/Medium/Low của phiên research không persist) —
    // suy lại mức từ score cho khớp schema Python: >=0.7 High, >=0.4 Medium, còn lại Low.
    @Named("relevanceLevel")
    default String relevanceLevel(BigDecimal score) {
        if (score == null) {
            return "Medium";
        }
        double v = score.doubleValue();
        return v >= 0.7 ? "High" : v >= 0.4 ? "Medium" : "Low";
    }

    // Python bắt buộc relevance_score float trong [0,1] — null quy về 0.5, clamp cho an toàn.
    @Named("safeScore")
    default Double safeScore(BigDecimal score) {
        return score == null ? 0.5 : Math.max(0.0, Math.min(1.0, score.doubleValue()));
    }

    @Named("suitabilityName")
    default String suitabilityName(SuitabilityLevel level) {
        if (level == null) {
            return "Medium";
        }
        String name = level.name().toLowerCase();
        return Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }

    @Named("emptyIfNull")
    default String emptyIfNull(String value) {
        return value == null ? "" : value;
    }
}
