package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Một nhóm lỗi CHƯA PHÂN LOẠI (UNKNOWN) gom theo chữ ký: nền tảng + mã gốc + subcode + dạng chuẩn hoá của message. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "UnclassifiedErrorGroupResponse", description = "Unclassified publishing failures grouped by signature.")
public class UnclassifiedErrorGroupResponse {

    Platform platform;

    String platformCode;

    String platformSubcode;

    @Schema(description = "Latest platform message of the group, redacted.")
    String messageSample;

    long count;

    long affectedUsers;

    Instant firstSeen;

    Instant lastSeen;

    String sampleReferenceCode;

    @Schema(description = "Latest raw error JSON of the group, redacted.")
    String sampleDetail;
}
