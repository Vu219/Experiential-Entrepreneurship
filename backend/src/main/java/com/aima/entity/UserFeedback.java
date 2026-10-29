package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Một lượt đánh giá/góp ý của người dùng gửi từ trong app (G1.3): 1–5 sao + nhận xét tuỳ chọn.
 * Admin xem ở {@code /admin/feedback}; xoá cứng tài khoản thì xoá theo (AccountPurgeService).
 */
@Entity
@Table(name = "user_feedback")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserFeedback extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    User user;

    @Column(name = "rating", nullable = false)
    Short rating;

    @Column(name = "comment", length = 1000)
    String comment;

    /** Trang người dùng đang đứng khi gửi (pathname, vd {@code /dashboard}) — để biết góp ý nói về màn nào. */
    @Column(name = "page", length = 120)
    String page;

    /** Dữ liệu MÔ PHỎNG do dev-seed sinh — admin thấy nhãn "Mẫu", xoá được bằng DELETE /admin/feedback/dev-seed. */
    @Column(name = "sample", nullable = false)
    @Builder.Default
    Boolean sample = false;
}
