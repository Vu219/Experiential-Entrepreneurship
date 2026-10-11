package com.aima.dto.response;

import com.aima.enums.FailureState;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/** Chi tiết bài lỗi cho admin: dòng danh sách + vòng đời + lỗi thô ĐÃ REDACT + timeline mọi lần thử. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminFailedPostDetailResponse", description = "Failed post detail for admins, with redacted raw error.")
public class AdminFailedPostDetailResponse {

    AdminFailedPostResponse post;

    UUID scheduleId;

    UUID contentItemId;

    FailureState state;

    @Schema(description = "Raw platform error of the latest failure (JSON, redacted). Admin only.")
    String rawError;

    List<AdminFailedPostAttemptResponse> attempts;
}
