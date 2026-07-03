package com.aima.mapper;

import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.VideoScriptPayload;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.response.ContentItemResponse;
import com.aima.entity.ContentItem;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring")
public interface ContentItemMapper {

    @Mapping(target = "hashtags", source = "hashtag", qualifiedByName = "splitHashtags")
    ContentItemResponse toContentItemResponse(ContentItem item);

    @Mapping(target = "script", source = "script", qualifiedByName = "formatScript")
    @Mapping(target = "hashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    @Mapping(target = "status", constant = "GENERATED")
    ContentItem toContentItem(GeneratedContentResult result);

    // FR-33: partial update — field null giữ nguyên giá trị cũ.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "hashtag", source = "hashtags", qualifiedByName = "joinHashtags")
    void update(ContentItemUpdateRequest request, @MappingTarget ContentItem item);

    @Named("splitHashtags")
    default List<String> splitHashtags(String hashtag) {
        if (hashtag == null || hashtag.isBlank()) {
            return List.of();
        }
        return Arrays.stream(hashtag.split(","))
                .map(String::trim)
                .filter(h -> !h.isEmpty())
                .collect(Collectors.toList());
    }

    @Named("joinHashtags")
    default String joinHashtags(List<String> hashtags) {
        return (hashtags == null || hashtags.isEmpty()) ? null : String.join(",", hashtags);
    }

    @Named("formatScript")
    default String formatScript(VideoScriptPayload script) {
        if (script == null) {
            return null;
        }
        List<String> lines = new ArrayList<>();
        if (StringUtils.hasText(script.getHook())) lines.add(script.getHook());
        if (StringUtils.hasText(script.getMainContent())) lines.add(script.getMainContent());
        if (script.getShotSuggestions() != null) lines.addAll(script.getShotSuggestions());
        if (StringUtils.hasText(script.getCta())) lines.add(script.getCta());
        return String.join("\n", lines);
    }
}
