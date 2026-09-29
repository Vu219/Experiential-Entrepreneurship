package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Một mắt xích của chuỗi model dự phòng của một {@link AiTaskRouting}, thứ tự theo
 * {@code position} (0 = thử ngay sau model chính). AI service đi hết chuỗi trong cùng request.
 *
 * <p>Là cấu hình con của routing: PUT routing thay CẢ chuỗi (xoá cứng dòng cũ qua orphanRemoval,
 * không soft delete — lịch sử nằm ở snapshot trước/sau của {@code ai_config_audit}). Vì vậy
 * {@code deleted_at} kế thừa từ BaseEntity không dùng.</p>
 */
@Entity
@Table(name = "ai_task_routing_fallback",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_ai_routing_fallback_position", columnNames = {"routing_id", "position"}),
                @UniqueConstraint(name = "uk_ai_routing_fallback_model", columnNames = {"routing_id", "model_id"})
        },
        indexes = @Index(name = "idx_ai_routing_fallback_model", columnList = "model_id"))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiTaskRoutingFallback extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "routing_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    AiTaskRouting routing;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "model_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    AiModel model;

    /** 0-based, liên tục; thứ tự thử của AI service. */
    @Column(name = "position", nullable = false)
    Integer position;
}
