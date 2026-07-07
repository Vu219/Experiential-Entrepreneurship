package com.aima.entity;

import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "content_generation_jobs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ContentGenerationJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_strategy_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentStrategy contentStrategy;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Column(name = "topic", columnDefinition = "text")
    String topic;

    // Trend/idea gắn kèm lưu dạng UUID rời (không FK): resolve "mềm" lúc chạy job —
    // id không còn/không thuộc user thì bỏ qua, không làm hỏng job (xem worker).
    @Column(name = "trend_id")
    UUID trendId;

    @Column(name = "idea_id")
    UUID ideaId;

    @Column(name = "note", columnDefinition = "text")
    String note;

    @Column(name = "regenerate_from", columnDefinition = "text")
    String regenerateFrom;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    GenerationJobStatus status = GenerationJobStatus.PENDING;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_content_item_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentItem resultContentItem;
}
