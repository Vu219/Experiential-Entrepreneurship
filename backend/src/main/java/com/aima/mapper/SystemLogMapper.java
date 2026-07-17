package com.aima.mapper;

import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Mapper(componentModel = "spring")
public interface SystemLogMapper {

    SystemLog toLog(LogLevel level, String module, String message, String detail);

    SystemLogResponse toResponse(SystemLog log);

    List<SystemLogResponse> toResponseList(List<SystemLog> logs);

    /** Một dòng đã gom nhóm: createdAt = thời điểm mới nhất, count = số lần trùng (×N). */
    @Mapping(target = "createdAt", source = "lastAt")
    @Mapping(target = "detail", ignore = true)
    SystemLogResponse toGroupResponse(UUID id, LogLevel level, String module, String message,
                                      LocalDateTime lastAt, Long count);
}
