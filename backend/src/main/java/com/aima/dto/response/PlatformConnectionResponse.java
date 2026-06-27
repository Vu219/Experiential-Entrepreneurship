package com.aima.dto.response;

import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.TokenType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một kết nối tài khoản MXH trả về cho FE. KHÔNG bao giờ chứa accessToken/refreshToken (SEC-03).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformConnectionResponse", description = "Kết nối tài khoản MXH (không chứa token).")
public class PlatformConnectionResponse {

    UUID id;
    Platform platform;
    String accountName;
    String platformAccountId;
    String platformUsername;
    String avatarUrl;
    String profileUrl;
    PlatformAccountType accountType;
    TokenType tokenType;
    ConnectionStatus connectionStatus;
    String apiVersionUsed;

    LocalDateTime tokenIssuedAt;
    LocalDateTime tokenExpiredAt;
    LocalDateTime lastValidatedAt;
    LocalDateTime lastSyncAt;

    @Schema(description = "Số ngày còn lại trước khi token hết hạn (null nếu không hết hạn, vd Page token).")
    Long tokenDaysRemaining;

    @Schema(description = "ID kết nối gốc (User-level) nếu đây là Page/IG con.")
    UUID parentConnectionId;

    LocalDateTime createdAt;
}
