package com.aima.entity;

import com.aima.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class User extends BaseEntity {

    @Column(name = "user_name", nullable = false, unique = true)
    String username;

    @Column(name = "password")
    String password;

    @Column(name = "full_name", nullable = false, length = 100)
    String fullName;

    @Column(name = "email", nullable = false, unique = true)
    String email;

    @Column(name = "phone")
    String phone;

    @Column(name = "date_of_birth")
    LocalDate dateOfBirth;

    @Column(name = "provider", length = 20)
    String provider;

    @Column(name = "google_id", unique = true)
    String googleId;

    @ManyToOne
    @JoinColumn(name = "role_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    UserStatus status;

    @Column(name = "deletion_date")
    LocalDateTime deletionDate;

    @Column(name = "avatar_url", length = 500)
    String avatarUrl;

    @Column(name = "last_active_at")
    LocalDateTime lastActiveAt;

    @Column(name = "last_password_change_at")
    LocalDateTime lastPasswordChangeAt;

    @Column(name = "profile_completed")
    Boolean profileCompleted;

    // Xóa user (purge sau 30 ngày) phải dọn theo dữ liệu phụ thuộc để không vi phạm khóa ngoại.
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    List<BrandProfile> brandProfiles = new ArrayList<>();
}
