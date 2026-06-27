package com.aima.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình Meta (Facebook/Instagram + Threads). Map từ block {@code meta.*} trong application.yml.
 */
@ConfigurationProperties(prefix = "meta")
public record MetaProperties(
        App facebook,
        App threads,
        String graphBaseUrl,
        String threadsBaseUrl,
        boolean appSecretProofEnabled
) {
    public record App(
            String appId,
            String appSecret,
            String redirectUri,
            String scopes
    ) {
    }
}
