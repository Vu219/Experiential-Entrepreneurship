package com.aima.dto.response;

import com.aima.enums.OAuthSkipReason;
import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Một kênh Meta trả về trong lần liên kết nhưng KHÔNG được thêm. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "OAuthSkippedChannelResponse")
public class OAuthSkippedChannelResponse {
    Platform platform;

    @Schema(example = "Cà phê Mộc")
    String accountName;

    @Schema(description = "CHANNEL_LIMIT / PLAN_PLATFORM / PLATFORM_DISABLED", example = "CHANNEL_LIMIT")
    OAuthSkipReason reason;
}
