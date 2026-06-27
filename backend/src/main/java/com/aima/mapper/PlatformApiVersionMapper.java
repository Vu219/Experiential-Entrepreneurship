package com.aima.mapper;

import com.aima.dto.response.ApiVersionHistoryResponse;
import com.aima.dto.response.ApiVersionResponse;
import com.aima.entity.PlatformApiVersion;
import com.aima.entity.PlatformApiVersionHistory;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PlatformApiVersionMapper {

    ApiVersionResponse toResponse(PlatformApiVersion version);

    List<ApiVersionResponse> toResponseList(List<PlatformApiVersion> versions);

    @Mapping(target = "changedByName", source = "changedBy.fullName")
    ApiVersionHistoryResponse toHistoryResponse(PlatformApiVersionHistory history);

    List<ApiVersionHistoryResponse> toHistoryResponseList(List<PlatformApiVersionHistory> history);
}
