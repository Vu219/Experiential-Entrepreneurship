package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Kết quả dry-run của job sửa dữ liệu trạng thái (Phase 6) — chỉ id + trạng thái, KHÔNG nội dung/token.
 * {@code planToken} phải gửi lại khi apply: dữ liệu đổi sau dry-run → token khác → apply bị từ chối.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentStatusRepairReport", description = "Dry-run of the one-off content status repair (ids/statuses only).")
public class ContentStatusRepairReport {

    @Schema(description = "Hash of the planned changes; required to apply exactly this plan.")
    String planToken;
    Instant generatedAt;
    @Schema(description = "Latest applied Flyway version (schema drift check); null when unavailable.")
    String flywayVersion;

    @Schema(description = "Items whose stored aggregate status differs from the resolver.")
    List<Change> itemChanges;
    @Schema(description = "Unpublished Instagram schedules that apply would hold with UNSUPPORTED_MEDIA.")
    List<UUID> instagramSchedules;
    @Schema(description = "ON_HOLD schedules without any hold reason (legacy, reported only).")
    List<UUID> unclassifiedHolds;
    @Schema(description = "Items in the publishing pipeline with reviewStatus NONE (review history unknown, reported only).")
    List<UUID> reviewUnknown;
    @Schema(description = "Value counts per status column (enum audit before any cleanup).")
    Map<String, Map<String, Long>> enumUsage;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Change {
        UUID itemId;
        String from;
        String to;
        @Schema(description = "Why: publishing/production states of the item's current versions (no content).")
        String reason;
    }
}
