package com.aima.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;

/**
 * Gói dịch vụ (FREE/PLUS/PRO + gói admin tự thêm) — nguồn dữ liệu DUY NHẤT cho cả
 * trang admin "Quản lý gói" lẫn landing page (GET /plans/public). Nội dung hiển thị
 * lưu song ngữ (…Vi/…En) vì landing có nút đổi ngôn ngữ.
 * Ba gói lõi ({@link #CORE_CODES}) không cho sửa code / xóa.
 */
@Entity
@Table(name = "plans")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Plan extends BaseEntity {

    /** Các gói lõi được seed sẵn — bất biến, không cho xóa (SEC: check trong service). */
    public static final Set<String> CORE_CODES = Set.of("FREE", "PLUS", "PRO");

    /** Mã gói (FREE/PLUS/PRO/...) — khớp enum UserPlan cho 3 gói lõi; không đổi sau khi tạo. */
    @Column(name = "code", nullable = false, length = 20, updatable = false)
    String code;

    @Column(name = "name_vi", nullable = false, length = 100)
    String nameVi;

    @Column(name = "name_en", nullable = false, length = 100)
    String nameEn;

    /** Giá VND / chu kỳ. 0 = miễn phí. */
    @Column(name = "price", nullable = false)
    @Builder.Default
    Long price = 0L;

    /** Nhãn chu kỳ hiển thị cạnh giá, vd "/tháng" · "trọn đời". */
    @Column(name = "billing_cycle_vi", length = 50)
    String billingCycleVi;

    @Column(name = "billing_cycle_en", length = 50)
    String billingCycleEn;

    /** Hạn mức token MÔ TẢ để hiển thị (chưa phải số dư thật của user). null = không giới hạn. */
    @Column(name = "token_quota")
    Long tokenQuota;

    @Column(name = "description_vi", length = 500)
    String descriptionVi;

    @Column(name = "description_en", length = 500)
    String descriptionEn;

    /** Bullet list trên card gói — mỗi dòng một tính năng (join bằng \n, tách ở PlanMapper). */
    @Column(name = "features_vi", columnDefinition = "TEXT")
    String featuresVi;

    @Column(name = "features_en", columnDefinition = "TEXT")
    String featuresEn;

    /** 2–3 dòng rút gọn cho pricing teaser ở landing (cùng định dạng \n). */
    @Column(name = "teaser_features_vi", columnDefinition = "TEXT")
    String teaserFeaturesVi;

    @Column(name = "teaser_features_en", columnDefinition = "TEXT")
    String teaserFeaturesEn;

    @Column(name = "cta_vi", length = 100)
    String ctaVi;

    @Column(name = "cta_en", length = 100)
    String ctaEn;

    /** Gói nổi bật (badge "Phổ biến nhất" + viền gradient trên landing). */
    @Column(name = "highlight", nullable = false)
    @Builder.Default
    Boolean highlight = false;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    Integer displayOrder = 0;

    /** Tắt = ẩn khỏi landing (GET /plans/public chỉ trả gói active). */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    Boolean isActive = true;
}
