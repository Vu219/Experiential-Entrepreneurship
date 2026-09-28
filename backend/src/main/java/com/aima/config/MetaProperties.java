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
        boolean appSecretProofEnabled,
        Webhook webhook
) {
    /**
     * {@code configId}: Facebook Login for Business configuration — có giá trị thì dialog dùng
     * {@code config_id} (quyền khai trong cấu hình trên Meta App) thay cho {@code scope}.
     */
    public record App(
            String appId,
            String appSecret,
            String redirectUri,
            String scopes,
            String configId
    ) {
    }

    /** Webhook nhận sự kiện sau đăng bài (gỡ bài/vi phạm) — verify token do mình tự đặt trên Meta App. */
    public record Webhook(String verifyToken) {
    }
}
