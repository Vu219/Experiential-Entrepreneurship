package com.aima.entity;

import com.aima.enums.AiTaskCode;
import com.aima.enums.BillingUnitType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Hệ số quy đổi hạn mức: token thật → {@code billable_units} trừ vào hạn mức gói của KHÁCH.
 * KHÁC với đơn giá USD trên {@code ai_models} (chi phí của MÌNH → cost_usd) — hai hệ độc lập.
 * <p>
 * VERSIONING BẮT BUỘC: append-only — "sửa giá" = đóng {@code effectiveTo} dòng đang mở rồi
 * insert dòng mới; KHÔNG update đè multiplier. Event {@code ai_usage} lưu billable_units đã
 * tính tại thời điểm gọi nên đổi hệ số không làm sai lịch sử.
 * Scope một dòng: taskCode null = mọi nghiệp vụ; modelCode null = mọi model.
 */
@Entity
@Table(name = "billing_rates", indexes = {
        @Index(name = "idx_billing_rates_task", columnList = "task_code"),
        @Index(name = "idx_billing_rates_effective", columnList = "effective_from")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BillingRate extends BaseEntity {

    /** null = áp cho mọi nghiệp vụ (dòng mặc định). */
    @Enumerated(EnumType.STRING)
    @Column(name = "task_code", length = 40)
    AiTaskCode taskCode;

    /** null = áp cho mọi model trong scope taskCode. */
    @Column(name = "model_code", length = 100)
    String modelCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_type", nullable = false, length = 20)
    BillingUnitType unitType;

    /** billable_units = round(multiplier × tokens), sàn bởi minCharge. */
    @Column(name = "multiplier", nullable = false, precision = 12, scale = 6)
    BigDecimal multiplier;

    /** Mức trừ tối thiểu mỗi lần gọi (null = không sàn). */
    @Column(name = "min_charge")
    Long minCharge;

    @Column(name = "effective_from", nullable = false)
    LocalDateTime effectiveFrom;

    /** null = đang hiệu lực; được set khi có version mới thay thế (không bao giờ sửa lùi). */
    @Column(name = "effective_to")
    LocalDateTime effectiveTo;

    /** Admin tạo dòng này (audit). null = seed hệ thống. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User createdBy;
}
