package com.aima.entity;

import com.aima.enums.TokenCreditStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Bucket token MUA THÊM — MỘT DÒNG cho MỖI lần mua/cấp (không cộng dồn một số) để
 * hoàn tiền/huỷ giao dịch trừ ngược đúng dòng. KHÁC GRANT đền bù ({@code usage_adjustments}
 * — hết kỳ mất): credit KHÔNG reset theo kỳ, chỉ hết khi tiêu hết hoặc quá {@code expiresAt}.
 * Tiêu thụ: hạn mức GÓI trước, hết mới đến credit — FIFO dòng sắp hết hạn trước
 * (xem TokenCreditService). Phần đã tiêu ghi trên event {@code ai_usage.credit_units}.
 */
@Entity
@Table(name = "token_credits", indexes = {
        @Index(name = "idx_token_credits_user", columnList = "user_id, status, expires_at")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TokenCredit extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @Column(name = "tokens_granted", nullable = false)
    Long tokensGranted;

    /** Đã tiêu (0..tokensGranted) — chỉ tăng qua UPDATE nguyên tử trong TokenCreditService. */
    @Column(name = "tokens_consumed", nullable = false)
    @Builder.Default
    Long tokensConsumed = 0L;

    /** null = không hết hạn. Có hạn → tiêu FIFO dòng sắp hết hạn trước. */
    @Column(name = "expires_at")
    LocalDateTime expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    @Builder.Default
    TokenCreditStatus status = TokenCreditStatus.ACTIVE;

    /** Tham chiếu giao dịch thanh toán (bảng payment chưa có — FK mềm, khớp usage_adjustments). */
    @Column(name = "payment_id")
    UUID paymentId;

    /** Ghi chú nguồn (vd mã gói top-up, lý do cấp thử nghiệm). */
    @Column(name = "note", length = 300)
    String note;
}
