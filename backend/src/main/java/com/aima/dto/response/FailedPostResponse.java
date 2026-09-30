package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/**
 * Một bài đăng thất bại của CHÍNH user cho trang "Bài lỗi & cần xử lý" (FR-35..FR-39).
 * Kèm {@code scheduleId} (dời giờ/hủy qua /schedules) và {@code contentItemId} (sửa/tạo lại nội dung)
 * để tái dùng đúng các hành động hồi phục đã có ở trang Lịch và wizard.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostResponse", description = "A failed post owned by the current user (FR-35..FR-39).")
public class FailedPostResponse {

    @Schema(description = "Post identifier.")
    UUID id;

    @Schema(description = "Schedule of the post — target of reschedule/cancel (/schedules/{id}).")
    UUID scheduleId;

    @Schema(description = "Original content item — target of edit/regenerate then reschedule.")
    UUID contentItemId;

    Platform platformName;

    @Schema(description = "Platform account the post targeted.")
    String accountName;

    @Schema(description = "Published caption (platform-formatted).")
    String caption;

    @Schema(description = "POLICY_VIOLATION = rejected content, no retry (FR-35/BR-07); others = technical error (FR-56/FR-72).")
    PublishErrorType errorType;

    @Schema(description = "Original platform error code (FR-35).")
    String errorCode;

    String errorMessage;

    @Schema(description = "When the final failure happened.")
    Instant failedAt;
}
