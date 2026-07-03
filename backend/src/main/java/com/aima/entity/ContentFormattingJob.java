package com.aima.entity;

import com.aima.enums.GenerationJobStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Async job that formats one {@link ContentItem} into per-platform
 * {@link ContentVersion}s via the AI service (FR-40..FR-46, NFR-04).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "content_formatting_jobs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ContentFormattingJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_item_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentItem contentItem;

    // Danh sách Platform yêu cầu, nối bằng dấu phẩy (vd "FACEBOOK,THREADS").
    @Column(name = "platforms", nullable = false, length = 100)
    String platforms;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    GenerationJobStatus status = GenerationJobStatus.PENDING;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;
}
