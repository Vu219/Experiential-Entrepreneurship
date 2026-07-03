package com.aima.dto.response;

import com.aima.enums.GenerationJobStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentFormattingJobResponse", description = "Async platform-formatting job (FR-40..FR-46, NFR-04).")
public class ContentFormattingJobResponse {

    @Schema(description = "Job identifier — poll GET /content-items/format-jobs/{id} until SUCCESS/FAILED.")
    UUID id;

    @Schema(description = "Job status.", example = "PENDING")
    GenerationJobStatus status;

    @Schema(description = "Failure reason when status is FAILED.")
    String errorMessage;

    @Schema(description = "Current (non-deleted) formatted versions of the content item; filled once SUCCESS.")
    List<ContentVersionResponse> versions;
}
