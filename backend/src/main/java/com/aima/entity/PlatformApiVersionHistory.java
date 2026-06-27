package com.aima.entity;

import com.aima.enums.VersionChangeType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Audit trail cho mỗi lần đổi version API của một nền tảng.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "platform_api_version_history")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlatformApiVersionHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_api_version_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    PlatformApiVersion platformApiVersion;

    @Column(name = "from_version", length = 20)
    String fromVersion;

    @Column(name = "to_version", length = 20)
    String toVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false, length = 30)
    VersionChangeType changeType;

    @Column(name = "notes", columnDefinition = "text")
    String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    User changedBy;
}
