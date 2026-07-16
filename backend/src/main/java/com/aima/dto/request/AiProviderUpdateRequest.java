package com.aima.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Cập nhật một AI provider (partial — field null = giữ nguyên).
 * {@code apiKey} là WRITE-ONLY: gửi lên để đổi key, không bao giờ xuất hiện trong response
 * (response chỉ có {@code apiKeyMasked}). Blank/null = giữ key hiện tại.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderUpdateRequest {

    String name;

    String apiKey;

    Boolean enabled;
}
