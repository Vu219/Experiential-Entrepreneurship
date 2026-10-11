package com.aima.dto.response;

import com.aima.enums.HoldReason;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Kết quả "Thử lại ngay": job mới đã giao worker, hoặc lịch bị tạm giữ (vd bài cần duyệt). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostRetryResponse", description = "Result of retrying a failed post.")
public class FailedPostRetryResponse {

    UUID postId;

    UUID scheduleId;

    @Schema(description = "New posting job (null when the schedule was put on hold instead).")
    UUID jobId;

    @Schema(description = "Why the schedule was put on hold instead of publishing (e.g. PENDING_REVIEW); null when dispatched.")
    HoldReason heldReason;
}
