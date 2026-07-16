package com.aima.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WebClient dùng riêng để gọi AI service (base URL cố định, không đổi theo từng request
 * như Meta — xem {@link MetaWebClientConfig} để so sánh).
 */
@Configuration
@EnableConfigurationProperties(AiServiceProperties.class)
public class AiServiceWebClientConfig {

    @Bean(name = "aiServiceWebClient")
    public WebClient aiServiceWebClient(AiServiceProperties properties) {
        WebClient.Builder builder = WebClient.builder().baseUrl(properties.baseUrl());
        // Auth nội bộ backend→AI: AI service từ chối request mang llm_config/test-connection
        // nếu thiếu header này (fail-closed phía AI). Không log token.
        if (properties.internalToken() != null && !properties.internalToken().isBlank()) {
            builder.defaultHeader("X-Internal-Token", properties.internalToken());
        }
        return builder.build();
    }
}
