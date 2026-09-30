package com.aima.dto.request;

import com.aima.enums.ReviewStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * FR-34: đổi trạng thái duyệt của bài (tách khỏi trạng thái tổng).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ContentItemReviewRequest", description = "Target review status for the review flow (FR-34).")
public class ContentItemReviewRequest {

    @NotNull(message = "CONTENT_STATUS_REQUIRED")
    @Schema(description = "Target review status; allowed: NONE/CHANGES_REQUESTED→NEED_REVIEW, "
            + "NEED_REVIEW→APPROVED, NEED_REVIEW→CHANGES_REQUESTED. Same as current = no-op.",
            example = "NEED_REVIEW", requiredMode = Schema.RequiredMode.REQUIRED)
    ReviewStatus reviewStatus;
}
