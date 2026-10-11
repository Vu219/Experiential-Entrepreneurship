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

/** Một nền tảng đang có dấu hiệu sự cố diện rộng (nhiều lỗi tạm thời từ nhiều kết nối trong thời gian ngắn). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformIncidentResponse", description = "A platform currently showing a wide outage.")
public class PlatformIncidentResponse {

    Platform platform;

    @Schema(description = "First temporary failure in the detection window.")
    Instant since;

    @Schema(description = "Temporary failures in the detection window.")
    long failures;

    @Schema(description = "Distinct connections affected in the detection window.")
    long accounts;
}
