package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.VersionStatus;
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
 * Trạng thái version API của một nền tảng (bảng Admin "Version API nền tảng").
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ApiVersionResponse", description = "Version API hiện hành của một nền tảng.")
public class ApiVersionResponse {
    UUID id;
    Platform platform;
    String currentVersion;
    String latestVersion;
    String minSupportedVersion;
    VersionStatus status;
    LocalDateTime currentVersionDeprecationDate;
    LocalDateTime lastCheckedAt;
}
