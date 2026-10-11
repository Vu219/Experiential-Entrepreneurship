package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một ánh xạ chữ ký lỗi → mã AIMA do admin tạo. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PublishErrorMappingResponse", description = "Admin mapping of a platform error signature to an AIMA code.")
public class PublishErrorMappingResponse {

    UUID id;

    Platform platform;

    String platformCode;

    String platformSubcode;

    String messagePattern;

    PublishErrorCode errorCode;

    String note;

    String updatedByEmail;

    LocalDateTime createdAt;

    @Schema(description = "Stored UNKNOWN failures re-classified by this request (applyToExisting).")
    int appliedCount;
}
