package com.aima.mapper;

import com.aima.dto.response.LandingSectionResponse;
import com.aima.entity.LandingSection;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Map;

@Mapper(componentModel = "spring")
public interface LandingSectionMapper {

    /**
     * draft/published đã parse từ JSON ở service; cờ chưa xuất bản do service so sánh.
     * Khai báo tường minh vì MapStruct coi tham số Map là nguồn property → mọi field đều mơ hồ.
     */
    @Mapping(target = "key", source = "section.sectionKey")
    @Mapping(target = "draft", source = "draft")
    @Mapping(target = "published", source = "published")
    @Mapping(target = "hasUnpublishedChanges", source = "hasUnpublishedChanges")
    @Mapping(target = "version", source = "section.version")
    @Mapping(target = "updatedAt", source = "section.updatedAt")
    @Mapping(target = "updatedBy", source = "section.updatedBy")
    @Mapping(target = "publishedAt", source = "section.publishedAt")
    @Mapping(target = "publishedBy", source = "section.publishedBy")
    LandingSectionResponse toResponse(LandingSection section, Map<String, Object> draft,
                                      Map<String, Object> published, boolean hasUnpublishedChanges);
}
