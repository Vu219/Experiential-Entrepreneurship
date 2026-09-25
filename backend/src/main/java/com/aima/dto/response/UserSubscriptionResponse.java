package com.aima.dto.response;

import com.aima.enums.PlanSource;
import com.aima.enums.UserPlan;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Gói hiện hành của MỘT user cho admin — đọc từ {@code subscriptions} (nguồn sự thật).
 * {@code planExpiresAt = null} nghĩa là KHÔNG hết hạn. {@code planLabel} là nhãn cache
 * {@code User.plan} sau thao tác, để FE cập nhật badge ở bảng danh sách.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserSubscriptionResponse {
    UUID userId;
    UUID planId;
    String planCode;
    String planNameVi;
    String planNameEn;
    PlanSource planSource;
    LocalDateTime planStartedAt;
    LocalDateTime planExpiresAt;
    UserPlan planLabel;
}
