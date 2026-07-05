package com.aima.entity;

import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Async publishing job for a {@link Post}, including retry bookkeeping
 * (BR-08, retry policy FR-56).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "posting_jobs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PostingJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Post post;

    @Column(name = "start_time")
    LocalDateTime startTime;

    @Column(name = "end_time")
    LocalDateTime endTime;

    @Column(name = "retry_count", nullable = false)
    Integer retryCount = 0;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    // FR-37: phân loại lỗi của lần đăng này (policy / tạm thời / vĩnh viễn).
    @Enumerated(EnumType.STRING)
    @Column(name = "error_type", length = 20)
    PublishErrorType errorType;

    // FR-56: thời điểm chạy lại — chỉ set trên job RETRYING (5/15/30 phút sau lần thất bại).
    @Column(name = "next_retry_at")
    LocalDateTime nextRetryAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    PostingJobStatus status;
}
