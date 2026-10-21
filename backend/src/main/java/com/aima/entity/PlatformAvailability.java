package com.aima.entity;

import com.aima.enums.Platform;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Trạng thái mở/khoá liên kết của một nền tảng TOÀN HỆ THỐNG (Flyway V20, một dòng / Platform) — admin đổi ở trang
 * "Version API nền tảng". Đọc DUY NHẤT qua {@code PlatformAvailabilityService}. Người sửa lưu id + email KHÔNG FK
 * (như {@code subscription_history}) để xoá cứng tài khoản admin không vướng khoá ngoại.
 */
@Entity
@Table(name = "platform_availability",
        uniqueConstraints = @UniqueConstraint(name = "uk_platform_availability_platform", columnNames = "platform"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PlatformAvailability extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    /** false = khoá: không kết nối mới, tài khoản đã kết nối bị khoá, lịch chưa đăng bị giữ (PLATFORM_DISABLED). */
    @Column(name = "connection_enabled", nullable = false)
    Boolean connectionEnabled;

    /** Lý do hiển thị cho người dùng khi khoá (null = FE dùng nhãn "Sắp ra mắt"). */
    @Column(name = "reason_vi", length = 300)
    String reasonVi;

    @Column(name = "reason_en", length = 300)
    String reasonEn;

    @Column(name = "status_changed_at")
    LocalDateTime statusChangedAt;

    @Column(name = "updated_by_id")
    UUID updatedById;

    @Column(name = "updated_by_email", length = 255)
    String updatedByEmail;
}
