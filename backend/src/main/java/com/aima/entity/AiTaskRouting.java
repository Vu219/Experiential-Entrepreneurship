package com.aima.entity;

import com.aima.enums.AiTaskCode;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

/**
 * Định tuyến model theo nghiệp vụ: mỗi {@link AiTaskCode} một dòng (partial unique index
 * {@code uk_ai_task_routing_task_code} WHERE deleted_at IS NULL) — model chính, chuỗi model dự
 * phòng có thứ tự ({@link #fallbacks}) và tham số sinh (temperature/max_tokens). null tham số =
 * dùng mặc định của provider/AI service.
 */
@Entity
@Table(name = "ai_task_routing", indexes = {
        @Index(name = "idx_ai_task_routing_task_code", columnList = "task_code")
})
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiTaskRouting extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "task_code", nullable = false, length = 40, updatable = false)
    AiTaskCode taskCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "primary_model_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    AiModel primaryModel;

    /**
     * LEGACY (trước chuỗi nhiều model): luôn được giữ = model ở {@code position 0} của
     * {@link #fallbacks} để bản backend cũ (rollback) vẫn đọc đúng. Code mới đọc
     * {@link #fallbackChain()}. Dòng cũ chỉ có cột này được AiConfigDataInitializer chuyển
     * thành position 0 lúc khởi động.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "fallback_model_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    AiModel fallbackModel;

    @Column(name = "temperature")
    Double temperature;

    @Column(name = "max_tokens")
    Integer maxTokens;

    /** Tắt = task này không dùng config DB (runtime rơi về cấu hình env của AI service). */
    @Column(name = "enabled", nullable = false)
    @Builder.Default
    Boolean enabled = true;

    /** Chuỗi model dự phòng theo thứ tự thử (AI service đi hết chuỗi trong cùng request). */
    @OneToMany(mappedBy = "routing", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<AiTaskRoutingFallback> fallbacks = new ArrayList<>();

    /**
     * Model dự phòng theo thứ tự — MỘT nguồn cho runtime/admin. Chưa có dòng
     * {@code ai_task_routing_fallback} (dữ liệu trước migration) → dùng cột legacy
     * {@code fallback_model_id}. Cần {@code fallbacks} đã fetch (query fetch-join) hoặc đang
     * trong transaction.
     */
    public List<AiModel> fallbackChain() {
        if (fallbacks != null && !fallbacks.isEmpty()) {
            return fallbacks.stream().map(AiTaskRoutingFallback::getModel).toList();
        }
        return fallbackModel == null ? List.of() : List.of(fallbackModel);
    }
}
