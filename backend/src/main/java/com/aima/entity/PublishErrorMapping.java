package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Ánh xạ do ADMIN thêm (Flyway V13): chữ ký lỗi của nền tảng (nền tảng + mã + subcode + mẫu message) →
 * mã chuẩn {@link PublishErrorCode} CÓ SẴN. Được {@code PublishErrorNormalizer} xét TRƯỚC luật mặc định
 * ({@code PublishErrorRules}) — để phân loại lỗi lạ mà không cần deploy. Không cho admin tự viết câu hiển thị:
 * mọi câu chữ đi qua catalog i18n của FE (docs/failed-posts-error-handling-plan.md §2).
 *
 * <p>Unique chữ ký trên dòng chưa xoá mềm là partial index (JPA không khai báo được) — tạo ở V13.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "publish_error_mappings")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PublishErrorMapping extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    /** {@code error.code} của nền tảng (số Graph) hoặc HTTP status khi body không phải JSON. */
    @Column(name = "platform_code", nullable = false, length = 50)
    String platformCode;

    /** {@code error.error_subcode}; null = mọi subcode. */
    @Column(name = "platform_subcode", length = 50)
    String platformSubcode;

    /** Chuỗi con (không phân biệt hoa thường) phải có trong message gốc; null = mọi message. */
    @Column(name = "message_pattern", length = 200)
    String messagePattern;

    @Enumerated(EnumType.STRING)
    @Column(name = "error_code", nullable = false, length = 40)
    PublishErrorCode errorCode;

    @Column(name = "note", length = 500)
    String note;

    /** Email admin sửa gần nhất (chốt lúc ghi). */
    @Column(name = "updated_by_email", length = 255)
    String updatedByEmail;
}
