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
 * Kết quả tạo đơn: FE điều hướng sang {@code checkoutUrl} và chạy đếm ngược tới
 * {@code expiresAt}.
 *
 * <p>{@code reused = true} nghĩa là đây là đơn PENDING CŨ được dùng lại (Q2) chứ không phải
 * đơn mới — {@code expiresAt} khi đó giữ nguyên mốc cũ, FE không được tự cộng lại TTL.</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CheckoutResponse {

    UUID paymentId;

    String checkoutUrl;

    LocalDateTime expiresAt;

    Long amount;

    String planCode;

    Boolean reused;
}
