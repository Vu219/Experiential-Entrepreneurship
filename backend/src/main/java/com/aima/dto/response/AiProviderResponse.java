package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Provider trả về FE — KHÔNG bao giờ mang full API key (SEC-03):
 * chỉ {@code apiKeyMasked} dạng "••••" + 4 ký tự cuối; null = chưa cấu hình key.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderResponse {

    UUID id;

    String code;

    String name;

    String apiKeyMasked;

    Boolean enabled;

    LocalDateTime lastTestedAt;

    String lastTestStatus;

    LocalDateTime updatedAt;
}
