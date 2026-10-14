package com.aima.mapper;

import com.aima.dto.response.GlobalSearchResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.PostSchedule;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.data.domain.Page;

/** Ô tìm kiếm toàn cục: gộp ba trang kết quả thành {@link GlobalSearchResponse} (mục dùng lại mapper sẵn có). */
@Mapper(componentModel = "spring", uses = {ContentItemMapper.class, ContentStrategyMapper.class, PostScheduleMapper.class})
public interface SearchMapper {

    @Mapping(target = "contents", source = "contents.content")
    @Mapping(target = "contentTotal", source = "contents.totalElements")
    @Mapping(target = "strategies", source = "strategies.content")
    @Mapping(target = "strategyTotal", source = "strategies.totalElements")
    @Mapping(target = "schedules", source = "schedules.content")
    @Mapping(target = "scheduleTotal", source = "schedules.totalElements")
    GlobalSearchResponse toResponse(Page<ContentItem> contents, Page<ContentStrategy> strategies, Page<PostSchedule> schedules);
}
