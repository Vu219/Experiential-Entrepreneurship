package com.aima.entity;

import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * MỘT lần thanh toán gói dịch vụ — sổ cái doanh thu, nguồn dữ liệu DUY NHẤT của trang admin
 * "Quản lý doanh thu" (`/admin/revenue`). Một dòng cho mỗi lần trả tiền, KHÔNG cộng dồn, để
 * hoàn tiền/đối soát trừ ngược đúng dòng (cùng triết lý {@link TokenCredit}).
 *
 * <p><b>payOS (quyết định 2026-07-20)</b> — schema đã chuẩn bị sẵn để gắn cổng thật mà không
 * cần migration: {@link #gateway} có sẵn giá trị {@code PAYOS}, {@link #gatewayTxnId} lưu
 * {@code orderCode} của payOS dạng chuỗi (partial unique → khoá idempotency cho webhook retry),
 * và {@link #rawPayload}/{@link #paidAt}/{@link #failedReason} là chỗ webhook ghi vào. Luồng
 * tạo payment link + xử lý webhook CHƯA implement — xem checklist ở {@code docs/ROADMAP_FUTURE.md}.
 *
 * <p><b>Công thức doanh thu (đã chốt 2026-07-20)</b> — net theo kỳ PHÁT SINH refund, không hồi tố:
 * doanh thu của một kỳ = tổng {@link #amount} của đơn có {@link #paidAt} rơi vào kỳ và đã từng
 * thu được tiền (PAID/REFUNDED/PARTIALLY_REFUNDED) TRỪ tổng {@link #refundedAmount} của đơn có
 * {@link #refundedAt} rơi vào kỳ. Nhờ tách {@code refundedAt} khỏi {@code paidAt}, số liệu của
 * kỳ đã đóng sổ không bao giờ thay đổi khi phát sinh hoàn tiền về sau.
 */
@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payments_user", columnList = "user_id"),
        @Index(name = "idx_payments_plan", columnList = "plan_id")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Payment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    /** Gói được mua. Giữ FK để báo cáo "cơ cấu gói" đọc động từ bảng plans (không hardcode). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Plan plan;

    /** Số tiền khách trả cho lần này, đơn vị nhỏ nhất của {@link #currency} (VND = đồng). */
    @Column(name = "amount", nullable = false)
    Long amount;

    /** Mã tiền tệ ISO-4217. MVP chỉ VND — cột có sẵn để sau bán quốc tế không phải migration. */
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    String currency = "VND";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    PaymentStatus status = PaymentStatus.PENDING;

    /**
     * Mốc TẠO ĐƠN — thời điểm nghiệp vụ, tách khỏi {@code created_at} của {@link BaseEntity}
     * (cột audit do {@code @CreationTimestamp} ghi, không set tay được). Cần riêng vì:
     * (1) webhook/đối soát payOS có thể tới muộn hoặc backfill, mốc đơn phải là mốc của cổng
     * chứ không phải lúc ta insert row; (2) đơn PENDING/FAILED không có {@code paidAt} nên đây
     * là mốc duy nhất để quy kỳ chúng (tỉ lệ giao dịch thất bại theo kỳ).
     */
    @Column(name = "ordered_at", nullable = false)
    LocalDateTime orderedAt;

    /** Mốc thu được tiền. null khi PENDING/FAILED — cũng là mốc quy kỳ cho doanh thu gộp. */
    @Column(name = "paid_at")
    LocalDateTime paidAt;

    /** Số tiền đã hoàn (≤ {@link #amount}). 0 = chưa hoàn đồng nào. */
    @Column(name = "refunded_amount", nullable = false)
    @Builder.Default
    Long refundedAmount = 0L;

    /**
     * Mốc phát sinh hoàn tiền — mốc quy kỳ cho phần TRỪ của công thức doanh thu. Tách riêng
     * khỏi {@link #paidAt} chính là thứ khiến "không hồi tố" thực hiện được.
     */
    @Column(name = "refunded_at")
    LocalDateTime refundedAt;

    /** Chu kỳ dịch vụ mà lần trả tiền này mua (hiển thị trên hoá đơn, đối soát với subscription). */
    @Column(name = "period_start")
    LocalDateTime periodStart;

    @Column(name = "period_end")
    LocalDateTime periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(name = "gateway", nullable = false, length = 20)
    @Builder.Default
    PaymentGateway gateway = PaymentGateway.MANUAL;

    /**
     * Mã giao dịch phía cổng — với payOS là {@code orderCode} (số nguyên) lưu dạng chuỗi.
     * Partial unique {@code WHERE deleted_at IS NULL AND gateway_txn_id IS NOT NULL} (tạo ở
     * {@code PaymentDataInitializer}) → là KHOÁ IDEMPOTENCY để webhook bị gửi lặp không sinh
     * hai dòng doanh thu. null cho bản ghi thủ công/seed không gắn cổng.
     */
    @Column(name = "gateway_txn_id", length = 100)
    String gatewayTxnId;

    /** Số hoá đơn hiển thị cho admin/khách (vd INV-000123). */
    @Column(name = "invoice_no", length = 50)
    String invoiceNo;

    /** Lý do thất bại/huỷ/hết hạn do cổng trả về — chỗ webhook payOS ghi vào. */
    @Column(name = "failed_reason", length = 500)
    String failedReason;

    /**
     * Payload thô của webhook cổng thanh toán, giữ nguyên để đối soát và điều tra tranh chấp.
     * Dùng TEXT (không jsonb) vì ta không truy vấn vào bên trong — chỉ đọc lại khi cần.
     */
    @Column(name = "raw_payload", columnDefinition = "TEXT")
    String rawPayload;

    /** Ghi chú nội bộ của admin. */
    @Column(name = "note", length = 500)
    String note;
}
