package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.PostSnapshotState;
import com.aima.enums.PostStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Actual post published to a platform, owned 1-1 by a {@link PostSchedule}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
// Mọi truy vấn gộp của trang Phân tích đều quét posts theo (status = POSTED, published_at trong kỳ)
// — index này để không phải seq scan cả bảng khi số bài lớn dần. ddl-auto=update tự tạo khi thiếu.
@Table(name = "posts", indexes = {
        @Index(name = "idx_posts_status_published_at", columnList = "status, published_at")
})
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Post extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false, unique = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PostSchedule schedule;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform_name", nullable = false, length = 20)
    Platform platformName;

    @Column(name = "platform_post_id", length = 255)
    String platformPostId;

    @Column(name = "published_at")
    Instant publishedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    PostStatus status;

    // ===== Snapshot nội dung chụp lúc dispatch (cùng transaction claim lịch + tạo job) — mọi retry
    // của chu kỳ đăng dùng đúng bản này, sửa bài sau đó không đổi bài đang/đã đăng. Token KHÔNG chụp.

    @Enumerated(EnumType.STRING)
    @Column(name = "snapshot_state", nullable = false, length = 20)
    PostSnapshotState snapshotState = PostSnapshotState.UNKNOWN_LEGACY;

    @Column(name = "snapshot_version_id")
    UUID snapshotVersionId;

    @Column(name = "snapshot_revision")
    Integer snapshotRevision;

    @Column(name = "snapshot_caption", columnDefinition = "text")
    String snapshotCaption;

    @Column(name = "snapshot_hashtag", columnDefinition = "text")
    String snapshotHashtag;

    @Column(name = "snapshot_cta", length = 255)
    String snapshotCta;

    @Column(name = "snapshot_media_format", length = 20)
    String snapshotMediaFormat;

    @Column(name = "snapshot_captured_at")
    Instant snapshotCapturedAt;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<PostingJob> postingJobs = new ArrayList<>();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<PublishResult> publishResults = new ArrayList<>();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<PostAnalytics> postAnalytics = new ArrayList<>();
}
