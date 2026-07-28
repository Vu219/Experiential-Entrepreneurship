package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.PostStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    LocalDateTime publishedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    PostStatus status;

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
