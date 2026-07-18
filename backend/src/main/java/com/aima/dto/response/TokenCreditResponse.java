package com.aima.dto.response;

import com.aima.enums.TokenCreditStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/** Một dòng token mua thêm (hiện dùng cho dev-seed verify FIFO/expiry; pha payment tái sử dụng). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TokenCreditResponse {

    UUID id;

    Long tokensGranted;

    Long tokensConsumed;

    /** null = không hết hạn. */
    LocalDateTime expiresAt;

    TokenCreditStatus status;

    String note;

    LocalDateTime createdAt;
}
