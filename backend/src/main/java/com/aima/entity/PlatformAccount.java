package com.aima.entity;

import com.aima.enums.ConnectionStatus;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.TokenType;
import com.aima.util.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "platform_accounts", indexes = {
        @Index(name = "idx_platform_accounts_user_platform", columnList = "user_id, platform_name"),
        @Index(name = "idx_platform_accounts_token_expired_at", columnList = "token_expired_at"),
        @Index(name = "idx_platform_accounts_connection_status", columnList = "connection_status")
})
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlatformAccount extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform_name", nullable = false, length = 20)
    Platform platformName;

    @Column(name = "account_name", nullable = false, length = 150)
    String accountName;

    // ID thật của tài khoản/Page/IG account trên nền tảng.
    @Column(name = "platform_account_id", nullable = false, length = 100)
    String platformAccountId;

    // Handle hiển thị, vd "@aima".
    @Column(name = "platform_username", length = 150)
    String platformUsername;

    @Column(name = "avatar_url", length = 500)
    String avatarUrl;

    @Column(name = "profile_url", length = 500)
    String profileUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 30)
    PlatformAccountType accountType;

    @Enumerated(EnumType.STRING)
    @Column(name = "token_type", nullable = false, length = 30)
    TokenType tokenType;

    // Token được mã hoá AES-256-GCM khi ghi DB và giải mã khi đọc (SEC-03).
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "access_token", nullable = false, columnDefinition = "text")
    String accessToken;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "refresh_token", columnDefinition = "text")
    String refreshToken;

    @Column(name = "token_expired_at")
    LocalDateTime tokenExpiredAt;

    @Column(name = "token_issued_at")
    LocalDateTime tokenIssuedAt;

    // Danh sách scope đã cấp, lưu dạng JSON array text.
    @Column(name = "scopes", columnDefinition = "text")
    String scopes;

    // Version Graph/Threads API dùng khi tạo/refresh kết nối này, vd "v25.0".
    @Column(name = "api_version_used", length = 20)
    String apiVersionUsed;

    @Column(name = "last_validated_at")
    LocalDateTime lastValidatedAt;

    @Column(name = "last_sync_at")
    LocalDateTime lastSyncAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "connection_status", nullable = false, length = 20)
    ConnectionStatus connectionStatus;

    // Page/IG account thuộc về User-level connection nào (self FK). Null với kết nối gốc.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_connection_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformAccount parentConnection;

    // Dữ liệu bổ sung tuỳ nền tảng (JSON).
    @Column(name = "metadata", columnDefinition = "jsonb")
    String metadata;
}
