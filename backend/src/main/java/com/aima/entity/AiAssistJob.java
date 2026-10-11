package com.aima.entity;

import com.aima.enums.AiAssistKind;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Tác vụ AI hỗ trợ chính sách (NFR-04, async): {@link AiAssistKind#POLICY_FIX} gợi ý sửa bài vi phạm,
 * {@link AiAssistKind#POLICY_CHECK} đánh giá rủi ro trước khi đăng. Kết quả lưu JSON ở {@code result} —
 * KHÔNG tự sửa bài: người dùng xem diff rồi tự áp dụng. {@code contentHash} = sha256(nền tảng + nội dung đăng
 * thật) để cache kết quả kiểm tra và biết gợi ý đã cũ (nội dung đổi sau khi tạo job).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "ai_assist_jobs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiAssistJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_version_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentVersion contentVersion;

    /** Bài lỗi được sửa (luồng "Bài lỗi"); null khi sửa từ cảnh báo trước khi đăng. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Post post;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    AiAssistKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    GenerationJobStatus status = GenerationJobStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    /** Mã lỗi AIMA của bài lỗi đang sửa (POLICY_FIX từ trang Bài lỗi). */
    @Enumerated(EnumType.STRING)
    @Column(name = "error_code", length = 40)
    PublishErrorCode errorCode;

    @Column(name = "content_hash", nullable = false, length = 64)
    String contentHash;

    /** Nội dung đăng thật lúc tạo job (caption + hashtag) — làm vế "trước" của diff. */
    @Column(name = "input_caption", columnDefinition = "text")
    String inputCaption;

    @Column(name = "result", columnDefinition = "text")
    String result;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    @Column(name = "applied_at")
    Instant appliedAt;

    @Column(name = "client_ip", length = 45)
    String clientIp;

    @Column(name = "user_agent", length = 300)
    String userAgent;
}
