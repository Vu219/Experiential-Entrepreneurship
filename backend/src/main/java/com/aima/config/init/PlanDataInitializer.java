package com.aima.config.init;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeature;
import com.aima.entity.PlanFeatureValue;
import com.aima.repository.PlanFeatureRepository;
import com.aima.repository.PlanRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Seed 3 gói lõi FREE/PLUS/PRO + bảng so sánh mặc định (nội dung chuyển từ
 * frontend/src/config/plans.ts — trước đây hardcode ở FE, nay DB là nguồn duy nhất).
 * Idempotent: chỉ seed khi bảng còn trống. Dùng cách này thay Flyway/Liquibase vì
 * dự án đang dùng {@code ddl-auto: update} (cùng mẫu {@code PlatformDataInitializer}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(4)
public class PlanDataInitializer implements CommandLineRunner {

    PlanRepository planRepository;
    PlanFeatureRepository featureRepository;

    @Override
    public void run(String... args) {
        seedPlans();
        seedFeatures();
    }

    private void seedPlans() {
        if (planRepository.countByDeletedAtIsNull() > 0) return;

        Plan free = Plan.builder()
                .code("FREE").nameVi("Free").nameEn("Free")
                .price(0L).billingCycleVi("trọn đời").billingCycleEn("forever")
                .tokenQuota(5L)
                .descriptionVi("Trải nghiệm quy trình AI với một thương hiệu.")
                .descriptionEn("Try the AI pipeline with one brand.")
                .featuresVi("1 hồ sơ thương hiệu\n5 bài viết AI mỗi tháng\nKết nối 1 nền tảng\nNghiên cứu xu hướng cơ bản")
                .featuresEn("1 brand profile\n5 AI posts per month\nConnect 1 platform\nBasic trend research")
                .teaserFeaturesVi("5 bài viết AI mỗi tháng\n1 thương hiệu · 1 nền tảng")
                .teaserFeaturesEn("5 AI posts per month\n1 brand · 1 platform")
                .ctaVi("Bắt đầu miễn phí").ctaEn("Start for free")
                .highlight(false).displayOrder(1).isActive(true)
                .build();

        Plan plus = Plan.builder()
                .code("PLUS").nameVi("Plus").nameEn("Plus")
                .price(499_000L).billingCycleVi("/tháng").billingCycleEn("/month")
                .tokenQuota(100L)
                .descriptionVi("Cho creator & shop cần nội dung đều đặn mỗi ngày.")
                .descriptionEn("For creators & shops posting every day.")
                .featuresVi("3 hồ sơ thương hiệu\n100 bài viết AI mỗi tháng\nĐủ 3 nền tảng: Facebook · Instagram · Threads\nLên lịch & tự động đăng bài\nPhân tích hiệu quả sau đăng")
                .featuresEn("3 brand profiles\n100 AI posts per month\nAll 3 platforms: Facebook · Instagram · Threads\nScheduling & auto-publishing\nPost-publish analytics")
                .teaserFeaturesVi("100 bài viết AI mỗi tháng\nĐủ 3 nền tảng · tự động đăng\nPhân tích sau đăng")
                .teaserFeaturesEn("100 AI posts per month\nAll 3 platforms · auto-publish\nPost-publish analytics")
                .ctaVi("Dùng thử Plus").ctaEn("Try Plus")
                .highlight(false).displayOrder(2).isActive(true)
                .build();

        Plan pro = Plan.builder()
                .code("PRO").nameVi("Pro").nameEn("Pro")
                .price(1_990_000L).billingCycleVi("/tháng").billingCycleEn("/month")
                .tokenQuota(null) // không giới hạn
                .descriptionVi("Cho doanh nghiệp nhỏ chạy nhiều thương hiệu cùng lúc.")
                .descriptionEn("For small businesses running multiple brands.")
                .featuresVi("Không giới hạn hồ sơ thương hiệu\nKhông giới hạn bài viết AI\nAI tối ưu chiến lược từ dữ liệu\nBáo cáo hiệu quả chuyên sâu\nHỗ trợ ưu tiên")
                .featuresEn("Unlimited brand profiles\nUnlimited AI posts\nData-driven strategy optimization\nIn-depth performance reports\nPriority support")
                .teaserFeaturesVi("Không giới hạn thương hiệu & bài viết\nAI tối ưu chiến lược từ dữ liệu\nHỗ trợ ưu tiên")
                .teaserFeaturesEn("Unlimited brands & posts\nData-driven optimization\nPriority support")
                .ctaVi("Chọn Pro").ctaEn("Choose Pro")
                .highlight(true).displayOrder(3).isActive(true)
                .build();

        planRepository.saveAll(List.of(free, plus, pro));
        log.info("[PlanInit] Seeded 3 core plans FREE/PLUS/PRO");
    }

    private void seedFeatures() {
        if (featureRepository.countByDeletedAtIsNull() > 0) return;
        Plan free = planRepository.findByCodeAndDeletedAtIsNull("FREE").orElse(null);
        Plan plus = planRepository.findByCodeAndDeletedAtIsNull("PLUS").orElse(null);
        Plan pro = planRepository.findByCodeAndDeletedAtIsNull("PRO").orElse(null);
        if (free == null || plus == null || pro == null) {
            log.warn("[PlanInit] Missing core plans — skip seeding comparison features");
            return;
        }
        Map<String, Plan> plans = Map.of("FREE", free, "PLUS", plus, "PRO", pro);

        record Row(String groupVi, String groupEn, String nameVi, String nameEn, Object[] values) {}
        // values theo thứ tự FREE, PLUS, PRO: Boolean = ô tick; String[]{vi,en} = ô text.
        List<Row> rows = List.of(
                new Row("Nội dung & AI", "Content & AI", "Bài viết AI mỗi tháng", "AI posts per month",
                        new Object[]{t("5"), t("100"), t("Không giới hạn", "Unlimited")}),
                new Row("Nội dung & AI", "Content & AI", "Hồ sơ thương hiệu", "Brand profiles",
                        new Object[]{t("1"), t("3"), t("Không giới hạn", "Unlimited")}),
                new Row("Nội dung & AI", "Content & AI", "Nghiên cứu xu hướng", "Trend research",
                        new Object[]{t("Cơ bản", "Basic"), t("Nâng cao", "Advanced"), t("Nâng cao", "Advanced")}),
                new Row("Nội dung & AI", "Content & AI", "Gợi ý media prompt cho ảnh/video", "Media prompts for images/video",
                        new Object[]{true, true, true}),
                new Row("Đăng bài & lịch", "Publishing & scheduling", "Nền tảng kết nối", "Connected platforms",
                        new Object[]{t("1"), t("3 (FB · IG · Threads)"), t("3 (FB · IG · Threads)")}),
                new Row("Đăng bài & lịch", "Publishing & scheduling", "Lên lịch & tự động đăng bài", "Scheduling & auto-publishing",
                        new Object[]{false, true, true}),
                new Row("Đăng bài & lịch", "Publishing & scheduling", "Gợi ý khung giờ vàng", "Prime-time suggestions",
                        new Object[]{false, true, true}),
                new Row("Phân tích & tối ưu", "Analytics & optimization", "Phân tích hiệu quả sau đăng", "Post-publish analytics",
                        new Object[]{false, true, true}),
                new Row("Phân tích & tối ưu", "Analytics & optimization", "AI tối ưu chiến lược từ dữ liệu", "Data-driven strategy optimization",
                        new Object[]{false, false, true}),
                new Row("Phân tích & tối ưu", "Analytics & optimization", "Báo cáo hiệu quả chuyên sâu", "In-depth performance reports",
                        new Object[]{false, false, true}),
                new Row("Hỗ trợ", "Support", "Kênh hỗ trợ", "Support channel",
                        new Object[]{t("Email"), t("Email"), t("Ưu tiên", "Priority")})
        );

        String[] codes = {"FREE", "PLUS", "PRO"};
        int order = 1;
        for (Row row : rows) {
            PlanFeature feature = PlanFeature.builder()
                    .groupVi(row.groupVi()).groupEn(row.groupEn())
                    .nameVi(row.nameVi()).nameEn(row.nameEn())
                    .displayOrder(order++)
                    .build();
            for (int i = 0; i < codes.length; i++) {
                Object v = row.values()[i];
                PlanFeatureValue.PlanFeatureValueBuilder value = PlanFeatureValue.builder()
                        .feature(feature)
                        .plan(plans.get(codes[i]));
                if (v instanceof Boolean b) {
                    value.boolValue(b);
                } else {
                    String[] text = (String[]) v;
                    value.textVi(text[0]).textEn(text[1]);
                }
                feature.getValues().add(value.build());
            }
            featureRepository.save(feature);
        }
        log.info("[PlanInit] Seeded {} comparison feature rows", rows.size());
    }

    /** Ô text song ngữ; gọi t(x) khi hai ngôn ngữ giống nhau (số liệu). */
    private static String[] t(String vi, String en) {
        return new String[]{vi, en};
    }

    private static String[] t(String both) {
        return new String[]{both, both};
    }
}
