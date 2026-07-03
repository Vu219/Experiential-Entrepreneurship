package com.aima.mapper;

import com.aima.dto.request.ContentStrategyRequest;
import com.aima.dto.response.ContentStrategyResponse;
import com.aima.entity.ContentStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

import java.util.ArrayList;
import java.util.List;

@Mapper(componentModel = "spring")
public interface ContentStrategyMapper {

    // entity → response (đổi tên field về đúng tên FE đang dùng + brandId từ brandProfile).
    @Mapping(target = "brandId", source = "brandProfile.id")
    @Mapping(target = "timeSlots", source = "preferredTimes")
    @Mapping(target = "audiences", source = "targetAudience")
    @Mapping(target = "styles", source = "contentStyle")
    @Mapping(target = "ctas", source = "ctaTypes")
    @Mapping(target = "frequencyUnit", source = "frequencyUnit", defaultValue = ContentStrategy.DEFAULT_FREQUENCY_UNIT)
    ContentStrategyResponse toResponse(ContentStrategy strategy);

    List<ContentStrategyResponse> toResponseList(List<ContentStrategy> strategies);

    // request → entity (create). brandProfile do service set; đổi tên field DTO → entity.
    @Mapping(target = "brandProfile", ignore = true)
    @Mapping(target = "preferredTimes", source = "timeSlots")
    @Mapping(target = "targetAudience", source = "audiences")
    @Mapping(target = "contentStyle", source = "styles")
    @Mapping(target = "ctaTypes", source = "ctas")
    @Mapping(target = "name", source = "name", qualifiedByName = "trim")
    ContentStrategy toContentStrategy(ContentStrategyRequest request);

    // request → entity (update, partial-safe field rename giữ nguyên brandProfile).
    @Mapping(target = "brandProfile", ignore = true)
    @Mapping(target = "preferredTimes", source = "timeSlots")
    @Mapping(target = "targetAudience", source = "audiences")
    @Mapping(target = "contentStyle", source = "styles")
    @Mapping(target = "ctaTypes", source = "ctas")
    @Mapping(target = "name", source = "name", qualifiedByName = "trim")
    void update(ContentStrategyRequest request, @MappingTarget ContentStrategy strategy);

    @Named("trim")
    default String trim(String value) {
        return value == null ? null : value.trim();
    }

    // Never store a null collection: a missing list becomes an empty one
    // (goals / contentTypes / styles / ctas / timeSlots / audiences are all free-text List<String>).
    default List<String> mapStringList(List<String> values) {
        return values == null ? new ArrayList<>() : new ArrayList<>(values);
    }
}
