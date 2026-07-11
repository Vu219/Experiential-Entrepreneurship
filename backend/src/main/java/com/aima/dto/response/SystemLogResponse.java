package com.aima.dto.response;

import com.aima.enums.LogLevel;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "SystemLogResponse", description = "One system log line (FR-74/FR-84).")
public class SystemLogResponse {

    UUID id;

    @Schema(description = "ERROR / WARN / INFO / DEBUG.")
    LogLevel level;

    @Schema(description = "Component that produced the log, e.g. \"posting.worker\".")
    String module;

    String message;

    @Schema(description = "Technical detail (abbreviated stack trace), if any.")
    String detail;

    @Schema(description = "When it was recorded.")
    LocalDateTime createdAt;
}
