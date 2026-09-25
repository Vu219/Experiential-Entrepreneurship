package com.aima.dto.payos;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Body {@code POST /v2/payment-requests} của payOS. Tên field phải đúng y hệt tài liệu —
 * đây là hợp đồng với bên ngoài, không phải DTO nội bộ (cùng tinh thần {@code dto/ai/*}).
 *
 * <p>Ràng buộc dễ sai, đã xác minh:</p>
 * <ul>
 *   <li>{@link #amount} là VND <b>nguyên</b> — KHÔNG nhân 100.</li>
 *   <li>{@link #orderCode} là số nguyên (không phải chuỗi).</li>
 *   <li>{@link #expiredAt} là <b>Unix timestamp giây</b> (Int32), không phải mili giây.</li>
 *   <li>{@link #signature} ký trên đúng 5 trường, xếp alphabet, KHÔNG URL-encode — xem
 *       {@code PayOSSignature.createLinkData}.</li>
 * </ul>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreatePaymentLinkPayload {

    Long orderCode;

    Long amount;

    String description;

    String returnUrl;

    String cancelUrl;

    Long expiredAt;

    String signature;
}
