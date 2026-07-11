package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminSystemStatusResponse", description = "System health overview for the admin dashboard (FR-81).")
public class AdminSystemStatusResponse {

    @Schema(description = "Health of core dependencies (database, redis, AI service).")
    List<ServiceHealthResponse> services;

    long totalUsers;

    @Schema(description = "Currently ACTIVE platform connections.")
    long activeConnections;

    @Schema(description = "Posts published in the last 24 hours.")
    long postedLast24h;

    @Schema(description = "Posts that failed in the last 24 hours.")
    long failedLast24h;

    @Schema(description = "Schedules waiting to be published.")
    long pendingSchedules;

    @Schema(description = "Latest ERROR log lines (quick alerts).")
    List<SystemLogResponse> alerts;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "ServiceHealthResponse", description = "Health of one dependency.")
    public static class ServiceHealthResponse {

        @Schema(description = "database | redis | aiService.")
        String name;

        @Schema(description = "UP or DOWN.")
        String status;

        @Schema(description = "Error detail when DOWN.")
        String detail;
    }
}
