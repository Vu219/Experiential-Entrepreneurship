package com.aima.dto.request;

import com.aima.enums.ContentLifecycle;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * FR-34: review flow status change (Generated → Need Review → Approved).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentItemStatusRequest", description = "Target lifecycle status for the review flow (FR-34).")
public class ContentItemStatusRequest {

    @NotNull(message = "CONTENT_STATUS_REQUIRED")
    @Schema(description = "Target status; allowed transitions: GENERATED→NEED_REVIEW, NEED_REVIEW→APPROVED.",
            example = "NEED_REVIEW", requiredMode = Schema.RequiredMode.REQUIRED)
    ContentLifecycle status;
}
