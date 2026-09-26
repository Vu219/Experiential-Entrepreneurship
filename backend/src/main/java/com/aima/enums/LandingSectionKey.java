package com.aima.enums;

import com.aima.dto.landing.LandingContent;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;

import java.util.Arrays;

/**
 * Các section Landing Page quản trị được (không gồm "Chọn gói" — đã có Quản lý gói).
 * {@link #key} là giá trị lưu DB + dùng trên URL/JSON; {@link #contentType} là schema
 * nội dung để validate (xem {@link LandingContent}). Thứ tự khai báo = thứ tự hiển thị ở admin.
 */
public enum LandingSectionKey {
    HERO("hero", LandingContent.Hero.class),
    FEATURES("features", LandingContent.Features.class),
    HOW_IT_WORKS("how_it_works", LandingContent.HowItWorks.class),
    INTEGRATIONS("integrations", LandingContent.Integrations.class),
    CTA("cta", LandingContent.Cta.class),
    FAQ("faq", LandingContent.Faq.class),
    FOOTER("footer", LandingContent.Footer.class);

    private final String key;
    private final Class<?> contentType;

    LandingSectionKey(String key, Class<?> contentType) {
        this.key = key;
        this.contentType = contentType;
    }

    public String getKey() {
        return key;
    }

    public Class<?> getContentType() {
        return contentType;
    }

    public static LandingSectionKey fromKey(String key) {
        return Arrays.stream(values())
                .filter(s -> s.key.equals(key))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.LANDING_SECTION_NOT_FOUND));
    }
}
