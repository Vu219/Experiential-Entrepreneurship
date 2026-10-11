package com.aima.dto.response;

import com.aima.enums.ConnectionStatus;
import com.aima.enums.FailureState;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorAction;
import com.aima.enums.PublishErrorCategory;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorOwner;
import com.aima.enums.PublishErrorSeverity;
import com.aima.enums.PublishErrorType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Một bài đăng thất bại của CHÍNH user cho trang "Bài lỗi & cần xử lý" (FR-35..FR-39).
 * Kèm {@code scheduleId} (dời giờ/hủy qua /schedules) và {@code contentItemId}/{@code contentVersionId} (sửa nội dung)
 * để tái dùng đúng các hành động hồi phục đã có ở trang Lịch và thư viện nội dung.
 *
 * <p>KHÔNG chứa message gốc của nền tảng / chuỗi kỹ thuật: người dùng chỉ thấy {@link #code} (FE dịch thành câu
 * thân thiện) — test reflection {@code FailedPostRecoveryIntegrationTest} chặn thêm trường thô vào DTO này.</p>
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

    @Schema(description = "Platform version of the content item that failed — target of 'Edit content'.")
    UUID contentVersionId;

    Platform platformName;

    @Schema(description = "Platform account the post targeted.")
    UUID accountId;

    String accountName;

    @Schema(description = "Current status of the target connection (EXPIRED/ERROR → reconnect before retrying).")
    ConnectionStatus accountStatus;

    @Schema(description = "Published caption (platform-formatted).")
    String caption;

    @Schema(description = "Coarse legacy type: POLICY_VIOLATION = rejected content, no retry (FR-35/BR-07); others = technical.")
    PublishErrorType errorType;

    @Schema(description = "Original platform error code (FR-35), e.g. 190 / 368, or an internal AIMA code.")
    String errorCode;

    @Schema(description = "Deprecated — always null. Raw platform messages are admin-only; use `code`.", deprecated = true)
    String errorMessage;

    @Schema(description = "When the final (or latest) failure happened.")
    Instant failedAt;

    // ===== Chuẩn hoá lỗi (docs/failed-posts-error-handling-plan.md §3) =====

    @Schema(description = "Normalized AIMA error code — the FE catalog turns it into a friendly explanation.")
    PublishErrorCode code;

    PublishErrorCategory category;

    PublishErrorSeverity severity;

    @Schema(description = "USER = the user must act; SYSTEM = AIMA handles it (auto retry / logged for admins).")
    PublishErrorOwner owner;

    @Schema(description = "True when AIMA retries this kind of error automatically (FR-56).")
    boolean autoRetry;

    @Schema(description = "Actions available right now (already filtered by lifecycle, edited content and account).")
    List<PublishErrorAction> actions;

    @Schema(description = "Platform error_subcode, when sent.")
    String platformSubcode;

    @Schema(description = "Reference code to give support (ERR-XXXXXX).")
    String referenceCode;

    @Schema(description = "Lifecycle of the failure: AUTO_RETRYING / NEEDS_ACTION / DISMISSED / RESOLVED.")
    FailureState state;

    @Schema(description = "Attempts made in the current publishing cycle.")
    int attempt;

    @Schema(description = "Maximum attempts when the error is retried automatically (1 + 3 retries); null otherwise.")
    Integer maxAttempts;

    @Schema(description = "When AIMA retries next (AUTO_RETRYING only).")
    Instant nextRetryAt;

    @Schema(description = "The platform version was edited after the failure (content errors can be reposted).")
    boolean contentChanged;

    @Schema(description = "The target account is connected and ACTIVE.")
    boolean accountReady;
}
