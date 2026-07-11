package com.aima.mapper;

import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface SystemLogMapper {

    SystemLog toLog(LogLevel level, String module, String message, String detail);

    SystemLogResponse toResponse(SystemLog log);

    List<SystemLogResponse> toResponseList(List<SystemLog> logs);
}
