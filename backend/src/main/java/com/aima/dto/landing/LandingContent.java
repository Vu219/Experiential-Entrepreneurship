package com.aima.dto.landing;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Schema nội dung từng section của Landing Page (lưu JSON trong landing_sections).
 * Mọi chữ hiển thị là song ngữ {@link Text} vì landing có nút đổi vi/en.
 * Service convert JSON admin gửi lên → record tương ứng → Bean Validation → ghi lại JSON
 * đã chuẩn hoá (field lạ bị bỏ). Message của constraint = khoá ErrorCode.
 */
public final class LandingContent {

    private LandingContent() {
    }

    static final String INVALID = "LANDING_CONTENT_INVALID";

    /** Link nội bộ ("/pricing", "/#features"), http(s):// hoặc mailto:. */
    static final String HREF = "^(/[^\\s]*|https?://[^\\s]+|mailto:[^\\s@]+@[^\\s@]+)$";
    static final String HTTP_URL = "^https?://[^\\s]+$";
    /** Khoá icon/nền tảng — FE map sang icon, khoá lạ hiện icon mặc định. */
    static final String ICON_KEY = "^[a-z0-9-]{1,40}$";

    public record Text(
            @NotBlank(message = INVALID) @Size(max = 600, message = INVALID) String vi,
            @NotBlank(message = INVALID) @Size(max = 600, message = INVALID) String en) {
    }

    /** Chữ song ngữ được phép để trống (cả hai ngôn ngữ). */
    public record OptionalText(
            @Size(max = 600, message = INVALID) String vi,
            @Size(max = 600, message = INVALID) String en) {
    }

    public record Link(
            @NotNull(message = INVALID) @Valid Text label,
            @NotBlank(message = INVALID) @Pattern(regexp = HREF, message = INVALID) String href) {
    }

    /** Link ở footer: href trống = chỉ hiện chữ (mục chưa có trang). */
    public record FooterLink(
            @NotNull(message = INVALID) @Valid Text label,
            @Pattern(regexp = "^$|" + HREF, message = INVALID) String href) {
    }

    // ===== Hero =====
    public record Stat(
            @NotNull(message = INVALID) @PositiveOrZero(message = INVALID) Double value,
            @Size(max = 6, message = INVALID) String suffix,
            @NotNull(message = INVALID) @Valid Text label) {
    }

    public record Hero(
            @NotNull(message = INVALID) @Valid Text badge,
            @NotNull(message = INVALID) @Valid Text titleLine1,
            @NotNull(message = INVALID) @Valid Text titleHighlight,
            @NotNull(message = INVALID) @Valid Text subtitle,
            @NotNull(message = INVALID) @Valid Link primaryCta,
            @NotNull(message = INVALID) @Valid Link secondaryCta,
            @NotNull(message = INVALID) @Size(min = 1, max = 4, message = INVALID)
            List<@NotNull(message = INVALID) @Valid Stat> stats) {
    }

    // ===== Một quy trình, trọn vẹn =====
    public record FeatureItem(
            @NotBlank(message = INVALID) @Pattern(regexp = ICON_KEY, message = INVALID) String icon,
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text description) {
    }

    public record Features(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text subtitle,
            @NotNull(message = INVALID) @Size(min = 1, max = 12, message = INVALID)
            List<@NotNull(message = INVALID) @Valid FeatureItem> items) {
    }

    // ===== AIMA hoạt động thế nào? (số thứ tự = vị trí trong danh sách) =====
    public record Step(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text description) {
    }

    public record HowItWorks(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text subtitle,
            @NotNull(message = INVALID) @Size(min = 1, max = 6, message = INVALID)
            List<@NotNull(message = INVALID) @Valid Step> steps) {
    }

    // ===== Dải nền tảng tích hợp =====
    public record PlatformItem(
            @NotBlank(message = INVALID) @Size(max = 40, message = INVALID) String name,
            @Pattern(regexp = "^$|" + ICON_KEY, message = INVALID) String icon,
            @Size(max = 500, message = INVALID) @Pattern(regexp = "^$|" + HTTP_URL, message = INVALID) String logoUrl) {

        /** Phải có icon có sẵn HOẶC URL ảnh logo. */
        @JsonIgnore
        @AssertTrue(message = INVALID)
        public boolean isVisualPresent() {
            return (icon != null && !icon.isBlank()) || (logoUrl != null && !logoUrl.isBlank());
        }
    }

    public record Integrations(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Size(min = 1, max = 12, message = INVALID)
            List<@NotNull(message = INVALID) @Valid PlatformItem> platforms) {
    }

    // ===== Banner CTA cuối =====
    public record Cta(
            @NotNull(message = INVALID) @Valid Text badge,
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text subtitle,
            @NotNull(message = INVALID) @Valid Link primaryCta,
            @NotNull(message = INVALID) @Valid Link secondaryCta,
            @NotNull(message = INVALID) @Size(max = 3, message = INVALID)
            List<@NotNull(message = INVALID) @Valid Text> checks) {
    }

    // ===== FAQ =====
    public record FaqItem(
            @NotNull(message = INVALID) @Valid Text question,
            @NotNull(message = INVALID) @Valid Text answer) {
    }

    public record Faq(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Valid Text subtitle,
            @NotNull(message = INVALID) @Size(min = 1, max = 20, message = INVALID)
            List<@NotNull(message = INVALID) @Valid FaqItem> items) {
    }

    // ===== Footer =====
    public record Social(
            @NotBlank(message = INVALID) @Pattern(regexp = ICON_KEY, message = INVALID) String platform,
            @NotBlank(message = INVALID) @Size(max = 500, message = INVALID)
            @Pattern(regexp = HTTP_URL, message = INVALID) String url) {
    }

    public record FooterColumn(
            @NotNull(message = INVALID) @Valid Text title,
            @NotNull(message = INVALID) @Size(max = 10, message = INVALID)
            List<@NotNull(message = INVALID) @Valid FooterLink> links) {
    }

    public record Footer(
            @NotNull(message = INVALID) @Valid Text description,
            @NotBlank(message = INVALID) @Email(message = INVALID) @Size(max = 120, message = INVALID) String email,
            @NotNull(message = INVALID) @Size(max = 8, message = INVALID)
            List<@NotNull(message = INVALID) @Valid Social> socials,
            @NotNull(message = INVALID) @Size(min = 1, max = 4, message = INVALID)
            List<@NotNull(message = INVALID) @Valid FooterColumn> columns,
            @NotNull(message = INVALID) @Valid OptionalText newsletterText) {
    }
}
