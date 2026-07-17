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

    @Schema(description = "Tài nguyên tiến trình/container (JMX). null nếu không lấy được → FE ẩn.")
    HostMetricsResponse host;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "ServiceHealthResponse", description = "Health + chỉ số thật của một dependency.")
    public static class ServiceHealthResponse {

        @Schema(description = "database | redis | aiService.")
        String name;

        @Schema(description = "UP or DOWN.")
        String status;

        @Schema(description = "Error detail when DOWN.")
        String detail;

        @Schema(description = "Độ trễ đo được (ms) khi UP: DB = SELECT 1, Redis = PING, AI = probe.")
        Long latencyMs;

        @Schema(description = "PostgreSQL: số kết nối đang hoạt động của HikariCP. null với service khác.")
        Integer activeConnections;

        @Schema(description = "Redis: bộ nhớ đang dùng (human, vd \"1.2M\"). null nếu không lấy được.")
        String memoryUsed;

        @Schema(description = "Redis: tỉ lệ hit (%) = hits/(hits+misses). null nếu không lấy được.")
        Double hitRate;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "HostMetricsResponse", description = "Tài nguyên tiến trình JVM/container (không phải máy chủ vật lý).")
    public static class HostMetricsResponse {

        @Schema(description = "CPU tiến trình (%) 0..100. null nếu JMX không hỗ trợ.")
        Double cpuLoad;

        @Schema(description = "Heap đang dùng (MB).")
        Long memUsedMb;

        @Schema(description = "Heap tối đa (MB).")
        Long memMaxMb;

        @Schema(description = "Dung lượng đĩa còn trống (GB) tại thư mục làm việc.")
        Long diskFreeGb;

        @Schema(description = "Tổng dung lượng đĩa (GB) tại thư mục làm việc.")
        Long diskTotalGb;
    }
}
