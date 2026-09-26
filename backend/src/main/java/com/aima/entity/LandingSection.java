package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Nội dung một section của Landing Page (hero, features, faq…) — mỗi section một dòng.
 * Cơ chế nháp/xuất bản: admin "Lưu" chỉ ghi {@link #draftContent}; "Xuất bản" chép nháp sang
 * {@link #publishedContent} — landing công khai CHỈ đọc bản đã xuất bản.
 * Schema JSON theo {@code LandingContent}; seed từ {@code LandingDataInitializer}.
 */
@Entity
@Table(name = "landing_sections",
        uniqueConstraints = @UniqueConstraint(name = "uk_landing_sections_key", columnNames = "section_key"))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LandingSection extends BaseEntity {

    /** Khoá section (xem {@code LandingSectionKey#getKey}) — không đổi sau khi tạo. */
    @Column(name = "section_key", nullable = false, length = 40, updatable = false)
    String sectionKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draft_content", nullable = false, columnDefinition = "jsonb")
    String draftContent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "published_content", nullable = false, columnDefinition = "jsonb")
    String publishedContent;

    @Column(name = "published_at")
    LocalDateTime publishedAt;

    @Column(name = "published_by", length = 255)
    String publishedBy;

    @Column(name = "updated_by", length = 255)
    String updatedBy;

    /** Khoá lạc quan: 2 admin cùng sửa một section → người lưu sau nhận LANDING_VERSION_CONFLICT. */
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    Long version = 0L;
}
