package com.aima.config.init;

import com.aima.dto.landing.LandingContent.Cta;
import com.aima.dto.landing.LandingContent.Faq;
import com.aima.dto.landing.LandingContent.FaqItem;
import com.aima.dto.landing.LandingContent.FeatureItem;
import com.aima.dto.landing.LandingContent.Features;
import com.aima.dto.landing.LandingContent.Footer;
import com.aima.dto.landing.LandingContent.FooterColumn;
import com.aima.dto.landing.LandingContent.FooterLink;
import com.aima.dto.landing.LandingContent.Hero;
import com.aima.dto.landing.LandingContent.HowItWorks;
import com.aima.dto.landing.LandingContent.Integrations;
import com.aima.dto.landing.LandingContent.Link;
import com.aima.dto.landing.LandingContent.OptionalText;
import com.aima.dto.landing.LandingContent.PlatformItem;
import com.aima.dto.landing.LandingContent.Social;
import com.aima.dto.landing.LandingContent.Stat;
import com.aima.dto.landing.LandingContent.Step;
import com.aima.dto.landing.LandingContent.Text;
import com.aima.entity.LandingSection;
import com.aima.enums.LandingSectionKey;
import com.aima.repository.LandingSectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Seed nội dung Landing Page mặc định — chuyển nguyên văn từ chuỗi i18n / data.ts cũ của FE
 * (trước đây hardcode) để sau khi triển khai landing hiển thị y như cũ. Idempotent: chỉ tạo
 * section còn thiếu, không ghi đè nội dung admin đã sửa. Nháp = bản xuất bản lúc seed.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(7)
public class LandingDataInitializer implements CommandLineRunner {

    static final String CONTACT_EMAIL = "aimarketing.aima@gmail.com";

    LandingSectionRepository repository;
    ObjectMapper objectMapper;

    @Override
    public void run(String... args) {
        Map<LandingSectionKey, Object> defaults = Map.of(
                LandingSectionKey.HERO, hero(),
                LandingSectionKey.FEATURES, features(),
                LandingSectionKey.HOW_IT_WORKS, howItWorks(),
                LandingSectionKey.INTEGRATIONS, integrations(),
                LandingSectionKey.CTA, cta(),
                LandingSectionKey.FAQ, faq(),
                LandingSectionKey.FOOTER, footer());
        for (LandingSectionKey key : LandingSectionKey.values()) {
            if (repository.existsBySectionKey(key.getKey())) {
                continue;
            }
            try {
                String json = objectMapper.writeValueAsString(defaults.get(key));
                repository.save(LandingSection.builder()
                        .sectionKey(key.getKey())
                        .draftContent(json)
                        .publishedContent(json)
                        .publishedAt(LocalDateTime.now())
                        .build());
                log.info("[LandingInit] Seed section {}", key.getKey());
            } catch (Exception e) {
                log.error("[LandingInit] Không seed được section {}: {}", key.getKey(), e.getMessage());
            }
        }
    }

    private static Text t(String vi, String en) {
        return new Text(vi, en);
    }

    private static Hero hero() {
        return new Hero(
                t("Trợ lý marketing thông minh", "Your smart marketing assistant"),
                t("Tương lai của Marketing là", "The Future of Marketing is"),
                t("Tự động hoá", "Autonomous"),
                t("AIMA giúp bạn rút ngắn quy trình marketing — từ nghiên cứu xu hướng, tạo nội dung, lên lịch đăng bài đến phân tích hiệu quả trên mọi nền tảng.",
                        "AIMA helps you streamline your marketing workflow — from trend research and content creation to scheduling posts and analyzing performance across every platform."),
                new Link(t("Đặt Demo", "Book Demo"), "/register"),
                new Link(t("Dùng thử AIMA", "Try AIMA"), "/login"),
                List.of(
                        new Stat(3.0, "+", t("Nền tảng tích hợp", "Integrated platforms")),
                        new Stat(24.0, "/7", t("Đăng bài tự động", "Auto publishing")),
                        new Stat(10.0, "×", t("Tốc độ sáng tạo", "Creation speed"))));
    }

    private static Features features() {
        return new Features(
                t("Một quy trình, trọn vẹn", "One seamless workflow"),
                t("AIMA đồng hành cùng bạn qua từng bước của content marketing.",
                        "AIMA walks with you through every step of content marketing."),
                List.of(
                        new FeatureItem("search", t("Nghiên cứu xu hướng", "Trend research"),
                                t("AI quét xu hướng theo ngành hàng và đối thủ theo thời gian thực.",
                                        "AI scans industry trends and competitors in real time.")),
                        new FeatureItem("lightbulb", t("Đề xuất ý tưởng", "Idea suggestions"),
                                t("Gợi ý chủ đề, góc nhìn và định dạng phù hợp với thương hiệu của bạn.",
                                        "Topics, angles and formats tailored to your brand voice.")),
                        new FeatureItem("pen-line", t("Tạo nội dung", "Content creation"),
                                t("Tạo script, caption, hashtag và media tối ưu cho từng nền tảng.",
                                        "Generate scripts, captions, hashtags & media per platform.")),
                        new FeatureItem("calendar-clock", t("Lên lịch & tự đăng", "Schedule & auto-post"),
                                t("Lập lịch thông minh và tự động đăng bài 24/7 đa nền tảng.",
                                        "Smart scheduling and 24/7 auto publishing across platforms.")),
                        new FeatureItem("bar-chart", t("Thu thập dữ liệu", "Collect data"),
                                t("Tự động đo lường hiệu quả thực tế của mỗi bài đăng.",
                                        "Automatically measure the real performance of every post.")),
                        new FeatureItem("sparkles", t("Phân tích & tối ưu", "Analyze & optimize"),
                                t("Phân tích kết quả và tối ưu chiến lược cho các bài sau.",
                                        "Analyze results and optimize strategy for the next posts."))));
    }

    private static HowItWorks howItWorks() {
        return new HowItWorks(
                t("AIMA hoạt động thế nào?", "How does AIMA work?"),
                t("Ba bước để marketing tự chạy — bạn luôn là người duyệt cuối cùng.",
                        "Three steps to put marketing on autopilot — you always have the final say."),
                List.of(
                        new Step(t("Thiết lập thương hiệu 1 lần", "Set up your brand once"),
                                t("Tạo hồ sơ thương hiệu và chiến lược nội dung — AI hiểu giọng điệu, khách hàng và mục tiêu của bạn.",
                                        "Create a brand profile and content strategy — the AI learns your voice, audience and goals.")),
                        new Step(t("AI nghiên cứu & viết", "AI researches & writes"),
                                t("AI quét xu hướng, đề xuất ý tưởng và tạo nội dung tối ưu cho từng nền tảng.",
                                        "The AI scans trends, suggests ideas and generates content optimized for each platform.")),
                        new Step(t("Bạn duyệt, tự đăng & tối ưu", "You review, auto-publish & optimize"),
                                t("Duyệt nội dung, để hệ thống đăng đúng lịch rồi phân tích kết quả để tối ưu các bài sau.",
                                        "Approve the content, let the system publish on schedule, then analyze results to optimize future posts."))));
    }

    private static Integrations integrations() {
        return new Integrations(
                t("Hoạt động liền mạch với các nền tảng bạn đang dùng",
                        "Works seamlessly with the platforms you already use"),
                List.of(
                        new PlatformItem("Facebook", "facebook", null),
                        new PlatformItem("Instagram", "instagram", null),
                        new PlatformItem("Threads", "threads", null)));
    }

    private static Cta cta() {
        return new Cta(
                t("Bắt đầu trong 2 phút", "Get started in 2 minutes"),
                t("Sẵn sàng để marketing tự chạy?", "Ready to put marketing on autopilot?"),
                t("Thiết lập thương hiệu một lần — AI lo phần còn lại: nghiên cứu, viết bài, đăng và tối ưu.",
                        "Set up your brand once — the AI handles the rest: research, writing, publishing and optimizing."),
                new Link(t("Tạo tài khoản miễn phí", "Create a free account"), "/register"),
                new Link(t("Đặt Demo", "Book Demo"), "mailto:" + CONTACT_EMAIL),
                List.of(t("Chưa cần thẻ tín dụng", "No credit card required"),
                        t("Huỷ bất cứ lúc nào", "Cancel anytime")));
    }

    private static Faq faq() {
        return new Faq(
                t("Câu hỏi thường gặp", "Frequently asked questions"),
                t("Vài điều mọi người hay hỏi trước khi bắt đầu.", "A few things people ask before getting started."),
                List.of(
                        new FaqItem(t("AIMA hoạt động với những nền tảng nào?", "Which platforms does AIMA work with?"),
                                t("Hiện tại AIMA kết nối Facebook, Instagram và Threads. Hệ thống được thiết kế mở để bổ sung thêm nền tảng trong tương lai.",
                                        "AIMA currently connects to Facebook, Instagram and Threads. The system is designed to be extensible so more platforms can be added later.")),
                        new FaqItem(t("Tôi có cần biết viết content không?", "Do I need to know how to write content?"),
                                t("Không. Bạn chỉ cần thiết lập hồ sơ thương hiệu một lần — AI sẽ nghiên cứu xu hướng và viết nội dung; bạn duyệt hoặc chỉnh sửa trước khi đăng.",
                                        "No. Set up your brand profile once — the AI researches trends and writes the content; you review or edit before anything is published.")),
                        new FaqItem(t("AIMA có tự tạo hình ảnh/video không?", "Does AIMA generate images or videos?"),
                                t("Không. AI tạo media prompt — mô tả chi tiết hình ảnh/video phù hợp với bài viết — để bạn chủ động sản xuất theo đúng chất thương hiệu.",
                                        "No. The AI creates media prompts — detailed descriptions of images/videos that fit each post — so you produce visuals that match your brand.")),
                        new FaqItem(t("Tôi có thể huỷ gói bất cứ lúc nào không?", "Can I cancel anytime?"),
                                t("Có. Bạn có thể huỷ bất cứ lúc nào; gói Free dùng mãi mãi và không cần thẻ tín dụng.",
                                        "Yes. Cancel whenever you like; the Free plan is free forever and needs no credit card."))));
    }

    /**
     * Link mạng xã hội: bản cũ chỉ có icon, KHÔNG có URL thật → seed trang chủ nền tảng làm
     * chỗ giữ; admin thay bằng trang của công ty. Mục footer chưa có trang (Blog…) để href trống.
     */
    private static Footer footer() {
        return new Footer(
                t("Tự động hoá toàn bộ quy trình marketing — từ ý tưởng đến phân tích, vận hành 24/7.",
                        "Automate your entire marketing workflow — from idea to analytics, running 24/7."),
                CONTACT_EMAIL,
                List.of(
                        new Social("facebook", "https://www.facebook.com"),
                        new Social("instagram", "https://www.instagram.com"),
                        new Social("linkedin", "https://www.linkedin.com"),
                        new Social("youtube", "https://www.youtube.com")),
                List.of(
                        new FooterColumn(t("Sản phẩm", "Product"), List.of(
                                new FooterLink(t("Tính năng", "Features"), "/#features"),
                                new FooterLink(t("Bảng giá", "Pricing"), "/pricing"),
                                new FooterLink(t("Đặt Demo", "Book Demo"), "/login"),
                                new FooterLink(t("Dùng thử AIMA", "Try AIMA"), "/register"))),
                        new FooterColumn(t("Tài nguyên", "Resources"), List.of(
                                new FooterLink(t("Blog", "Blog"), ""),
                                new FooterLink(t("Hướng dẫn", "Guides"), ""),
                                new FooterLink(t("Tài liệu", "Documentation"), ""))),
                        new FooterColumn(t("Công ty", "Company"), List.of(
                                new FooterLink(t("Giới thiệu", "About"), ""),
                                new FooterLink(t("Liên hệ", "Contact"), "mailto:" + CONTACT_EMAIL),
                                new FooterLink(t("Tuyển dụng", "Careers"), "")))),
                new OptionalText("Nhận insight marketing & cập nhật sản phẩm mỗi tuần.",
                        "Get marketing insights & product updates every week."));
    }
}
