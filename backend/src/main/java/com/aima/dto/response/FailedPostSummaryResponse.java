package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Khối "Tổng quan lỗi" của trang "Bài lỗi & cần xử lý": tổng số bài lỗi, số vi phạm chính sách,
 * số lỗi kỹ thuật (= tổng - vi phạm).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostSummaryResponse", description = "Failure overview counts for the current user.")
public class FailedPostSummaryResponse {

    @Schema(description = "Total failed posts.")
    long total;

    @Schema(description = "Posts rejected for policy violation (no retry — FR-35/BR-07).")
    long policyViolation;

    @Schema(description = "Technical failures (retryable / reconnect / reschedule — FR-56/FR-72).")
    long technical;

    @Schema(description = "Failures waiting for the user (final failure, not dismissed).")
    long needsAction;

    @Schema(description = "Temporary failures AIMA is still retrying automatically (FR-56).")
    long autoRetrying;

    @Schema(description = "Failures the user dismissed.")
    long dismissed;
}
