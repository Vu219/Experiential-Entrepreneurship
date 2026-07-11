package com.aima.mapper;

import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SystemLogMapper {

    SystemLog toLog(LogLevel level, String module, String message, String detail);
}
