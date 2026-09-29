package com.aima.dto.response;

import com.aima.enums.GenerationJobStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Polled by the frontend (NFR-04: AI tasks are async; FE shows job status, never blocks).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentGenerationJobResponse", description = "Status of an async content-generation job.")
public class ContentGenerationJobResponse {

    @Schema(description = "Job id.")
    UUID id;

    @Schema(description = "Job status.", example = "PENDING")
    GenerationJobStatus status;

    @Schema(description = "Error message, present only when status is FAILED.")
    String errorMessage;

    @Schema(description = "ErrorCode name when FAILED (e.g. AI_TIMEOUT) — FE maps it to a friendly message.")
    String errorCode;

    @Schema(description = "B2: generated per-platform version, present only when status is SUCCESS.")
    ContentVersionResponse contentVersion;
}
