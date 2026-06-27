package com.aima.dto.response;

import com.aima.enums.VersionChangeType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một bản ghi lịch sử đổi version API (modal "Lịch sử thay đổi").
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ApiVersionHistoryResponse", description = "Một lần đổi version API.")
public class ApiVersionHistoryResponse {
    UUID id;
    String fromVersion;
    String toVersion;
    VersionChangeType changeType;
    String notes;
    String changedByName;
    LocalDateTime createdAt;
}
