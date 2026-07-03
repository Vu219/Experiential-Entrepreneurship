package com.aima.mapper;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ContentGenerationJobResponse;
import com.aima.entity.ContentGenerationJob;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = ContentItemMapper.class)
public interface ContentGenerationJobMapper {

    @Mapping(target = "contentItem", source = "resultContentItem")
    ContentGenerationJobResponse toResponse(ContentGenerationJob job);

    @Mapping(target = "contentStrategy", ignore = true)
    ContentGenerationJob toContentGenerationJob(ContentGenerationRequest request);
}
