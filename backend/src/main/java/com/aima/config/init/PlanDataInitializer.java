package com.aima.config.init;

import com.aima.entity.Plan;
import com.aima.entity.PlanFeatureLimits;
import com.aima.entity.PlanFeature;
import com.aima.entity.PlanFeatureValue;
import com.aima.repository.PlanFeatureRepository;
import com.aima.repository.PlanRepository;
import com.aima.service.PlanLimitService;
import com.aima.enums.PlanLimitKey;
import java.util.ArrayList;
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
 * Idempotent: chỉ seed khi bảng còn trống. Schema và CHECK do Flyway quản lý.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(4)
public class PlanDataInitializer implements CommandLineRunner {

    PlanRepository planRepository;
    PlanFeatureRepository featureRepository;
    PlanLimitService planLimitService;

    /** Hạn mức token LLM/tháng của 3 gói lõi (đã chốt): FREE 1.000 / PLUS 100.000 / PRO 1.000.000. */
    static final Map<String, Long> CORE_MONTHLY_TOKEN_LIMITS = Map.of(
            "FREE", 1_000L,
            "PLUS", 100_000L,
            "PRO", 1_000_000L
    );

    /**
     * Giới hạn của 3 gói lõi khi DB mới seed — cùng giá trị Flyway V15/V18/V20 backfill cho DB cũ. Trả bản MỚI mỗi lần
     * (embeddable là entity khả biến — không dùng chung một instance giữa các gói / với nơi đọc fail-closed).
     * Lượt AI kiểm tra chính sách: FREE 0 / PLUS 30 / PRO 200 (V15). Nền tảng: chỉ FACEBOOK (V20).
     */
    public static PlanFeatureLimits coreFeatureLimits(String code) {
        return switch (code) {
            case "PLUS" -> PlanFeatureLimits.builder()
                    .brandProfiles(3).strategiesPerBrand(5).connectedChannels(3).allowedPlatforms(CORE_ALLOWED_PLATFORMS)
                    .trendResearchPerPeriod(30).autoTrendResearch(true).ideasPerResearch(10)
                    .scheduling(true).scheduledPostsPerPeriod(100).activeSchedules(50).scheduleHorizonDays(30)
                    .goldenHours(true).analyticsHistoryDays(90).analyticsAdvanced(true).analyticsExport(false)
                    .strategyOptimizationPerPeriod(5).policyCheckAiPerPeriod(30).build();
            case "PRO" -> PlanFeatureLimits.builder()
                    .brandProfiles(-1).strategiesPerBrand(-1).connectedChannels(10).allowedPlatforms(CORE_ALLOWED_PLATFORMS)
                    .trendResearchPerPeriod(-1).autoTrendResearch(true).ideasPerResearch(20)
                    .scheduling(true).scheduledPostsPerPeriod(-1).activeSchedules(-1).scheduleHorizonDays(90)
                    .goldenHours(true).analyticsHistoryDays(365).analyticsAdvanced(true).analyticsExport(true)
                    .strategyOptimizationPerPeriod(-1).policyCheckAiPerPeriod(200).build();
            default -> PlanFeatureLimits.builder()
                    .brandProfiles(1).strategiesPerBrand(1).connectedChannels(1).allowedPlatforms(CORE_ALLOWED_PLATFORMS)
                    .trendResearchPerPeriod(3).autoTrendResearch(false).ideasPerResearch(5)
                    .scheduling(true).scheduledPostsPerPeriod(10).activeSchedules(5).scheduleHorizonDays(7)
                    .goldenHours(false).analyticsHistoryDays(7).analyticsAdvanced(false).analyticsExport(false)
                    .strategyOptimizationPerPeriod(0).policyCheckAiPerPeriod(0).build();
        };
    }

    /**
     * Dòng so sánh LIÊN KẾT giới hạn thật (V21 — cùng ánh xạ migration dùng cho DB cũ): giá trị từng cột tự lấy từ gói,
     * không nhập tay. Dòng không có ở đây nhập tay như cũ (admin thấy cảnh báo "không được hệ thống đảm bảo").
     */
    static final Map<String, PlanLimitKey> LINKED_COMPARISON_ROWS = Map.of(
            "Hồ sơ thương hiệu", PlanLimitKey.BRAND_PROFILES,
            "Nền tảng kết nối", PlanLimitKey.ALLOWED_PLATFORMS,
            "Lên lịch & tự động đăng bài", PlanLimitKey.SCHEDULING,
            "Gợi ý khung giờ vàng", PlanLimitKey.GOLDEN_HOURS,
            "Phân tích hiệu quả sau đăng", PlanLimitKey.ANALYTICS_HISTORY_DAYS,
            "AI tối ưu chiến lược từ dữ liệu", PlanLimitKey.STRATEGY_OPTIMIZATION_PER_PERIOD,
            "Báo cáo hiệu quả chuyên sâu", PlanLimitKey.ANALYTICS_EXPORT
    );

    /** Nền tảng 3 gói lõi được phép khi seed (V20). */
    static final String CORE_ALLOWED_PLATFORMS = "FACEBOOK";

    @Override
    public void run(String... args) {
        seedPlans();
        seedFeatures();
        backfillMonthlyTokenLimits();
        backfillCustomPlanLimits();
    }

    /**
     * Gói TỰ TẠO (không phải FREE/PLUS/PRO) còn ô giới hạn null (= "Mặc định hệ thống") → ghi cứng giá trị HIỆU LỰC hiện
     * tại theo {@code aima.plan-limits.defaults.*} / {@code aima.ai-assist.*} để hành vi khách đang dùng không đổi khi
     * deploy V20, sau đó gói tự tạo bắt buộc điền đủ (PLAN_LIMIT_VALUE_REQUIRED). Làm ở Java (không phải Flyway) vì
     * mặc định đọc từ env. Idempotent: chỉ ghi ô null.
     */
    private void backfillCustomPlanLimits() {
        PlanFeatureLimits defaults = planLimitService.defaultFeatureLimits();
        int plans = 0;
        for (Plan plan : planRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc()) {
            if (Plan.CORE_CODES.contains(plan.getCode())) {
                continue;
            }
            PlanFeatureLimits limits = plan.getFeatureLimits() != null ? plan.getFeatureLimits() : new PlanFeatureLimits();
            List<String> filled = new ArrayList<>();
            for (PlanLimitKey key : PlanLimitKey.values()) {
                if (key.rawValue(limits) == null) {
                    key.write(limits, key.rawValue(defaults));
                    filled.add(key.name());
                }
            }
            if (!filled.isEmpty()) {
                plan.setFeatureLimits(limits);
                planRepository.save(plan);
                plans++;
                log.info("[PlanInit] Gói tự tạo {} — ghi cứng giá trị mặc định hiệu lực cho {}", plan.getCode(), filled);
            }
        }
        if (plans > 0) {
            log.info("[PlanInit] Đã ghi cứng giới hạn cho {} gói tự tạo", plans);
        }
    }

    /**
     * DB có sẵn từ trước khi thêm cột monthly_token_limit: điền hạn mức mặc định cho 3 gói
     * lõi còn null (ddl-auto=update chỉ tạo cột, không có Flyway). Chỉ đụng ô null nên
     * không ghi đè giá trị admin đã chỉnh.
     */
    private void backfillMonthlyTokenLimits() {
        CORE_MONTHLY_TOKEN_LIMITS.forEach((code, limit) ->
                planRepository.findByCodeAndDeletedAtIsNull(code)
                        .filter(plan -> plan.getMonthlyTokenLimit() == null)
                        .ifPresent(plan -> {
                            plan.setMonthlyTokenLimit(limit);
                            planRepository.save(plan);
                            log.info("[PlanInit] Backfilled monthly_token_limit={} for plan {}", limit, code);
                        }));
    }

    private void seedPlans() {
        if (planRepository.countByDeletedAtIsNull() > 0) return;

        Plan free = Plan.builder()
                .code("FREE").nameVi("Free").nameEn("Free")
                .price(0L).billingCycleVi("trọn đời").billingCycleEn("forever")
                .monthlyTokenLimit(CORE_MONTHLY_TOKEN_LIMITS.get("FREE"))
                .featureLimits(coreFeatureLimits("FREE"))
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
                .price(199_000L).billingCycleVi("/tháng").billingCycleEn("/month")
                .monthlyTokenLimit(CORE_MONTHLY_TOKEN_LIMITS.get("PLUS"))
                .featureLimits(coreFeatureLimits("PLUS"))
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
                .price(499_000L).billingCycleVi("/tháng").billingCycleEn("/month")
                .monthlyTokenLimit(CORE_MONTHLY_TOKEN_LIMITS.get("PRO"))
                .featureLimits(coreFeatureLimits("PRO"))
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
                    .limitKey(LINKED_COMPARISON_ROWS.get(row.nameVi()))
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
