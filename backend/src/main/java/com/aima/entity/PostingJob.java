package com.aima.entity;

import com.aima.enums.FailureResolution;
import com.aima.enums.PostingJobStatus;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

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
    Instant startTime;

    @Column(name = "end_time")
    Instant endTime;

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
    Instant nextRetryAt;

    // ===== Chuẩn hoá lỗi (Flyway V13, docs/failed-posts-error-handling-plan.md) — chỉ có trên job FAILED.
    // Job cũ (trước V13) để null: đọc qua PublishErrorNormalizer.resolve (chuẩn hoá lúc đọc, không ghi đè).

    // Mã lỗi chuẩn AIMA — người dùng chỉ thấy mã này (FE dịch ra câu thân thiện), không thấy message gốc.
    @Enumerated(EnumType.STRING)
    @Column(name = "error_code", length = 40)
    PublishErrorCode errorCode;

    // Mã + subcode GỐC của nền tảng (FR-35), vd 190 / 463; mã nội bộ AIMA khi lỗi không đến từ nền tảng.
    @Column(name = "platform_error_code", length = 50)
    String platformErrorCode;

    @Column(name = "platform_error_subcode", length = 50)
    String platformErrorSubcode;

    // JSON chi tiết lỗi ĐÃ REDACT (SensitiveDataRedactor) — CHỈ trả cho admin, không bao giờ vào DTO của user.
    @Column(name = "error_detail", columnDefinition = "text")
    String errorDetail;

    // Lần lỗi này đã được xử lý thế nào (chỉ ghi trên job FAILED cuối của bài); null = chưa xử lý.
    @Enumerated(EnumType.STRING)
    @Column(name = "resolution", length = 20)
    FailureResolution resolution;

    @Column(name = "resolved_at")
    Instant resolvedAt;

    // Id người xử lý (user chủ bài hoặc admin) — không FK: log còn đọc được sau khi user bị xoá.
    @Column(name = "resolved_by")
    UUID resolvedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    PostingJobStatus status;
}
