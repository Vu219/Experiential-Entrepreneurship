package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.VersionStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;

/**
 * Cấu hình version API hiện hành cho mỗi nền tảng (một row / Platform).
 * Admin có thể đổi {@code currentVersion} và áp dụng tức thì cho mọi lời gọi Meta API sau đó.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "platform_api_versions",
        uniqueConstraints = @UniqueConstraint(name = "uk_platform_api_versions_platform", columnNames = "platform"))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlatformApiVersion extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Column(name = "current_version", nullable = false, length = 20)
    String currentVersion;

    @Column(name = "latest_version", length = 20)
    String latestVersion;

    @Column(name = "min_supported_version", length = 20)
    String minSupportedVersion;

    @Column(name = "current_version_deprecation_date")
    LocalDateTime currentVersionDeprecationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    VersionStatus status;

    @Column(name = "last_checked_at")
    LocalDateTime lastCheckedAt;

    // Admin gần nhất đã cập nhật version (nullable: bản ghi seed / job tự động).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User updatedBy;

    @OneToMany(mappedBy = "platformApiVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<PlatformApiVersionHistory> history = new ArrayList<>();
}
