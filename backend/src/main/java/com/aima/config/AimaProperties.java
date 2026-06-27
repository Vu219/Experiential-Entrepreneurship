package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình riêng AIMA: khoá mã hoá + tham số luồng OAuth liên kết MXH.
 * Map từ block {@code aima.*} trong application.yml.
 */
@ConfigurationProperties(prefix = "aima")
public record AimaProperties(
        Encryption encryption,
        OAuth oauth
) {
    public record Encryption(String key) {
    }

    public record OAuth(
            long stateTtlMinutes,
            String frontendSuccessRedirect,
            String frontendErrorRedirect
    ) {
    }
}
