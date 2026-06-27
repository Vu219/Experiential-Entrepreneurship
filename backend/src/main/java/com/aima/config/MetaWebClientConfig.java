package com.aima.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WebClient & ObjectMapper dùng chung cho các service Meta API (Graph + Threads).
 * Base URL theo từng nền tảng được truyền lúc gọi (.uri()) nên client ở đây không gắn cứng base URL.
 */
@Configuration
@EnableConfigurationProperties({MetaProperties.class, AimaProperties.class})
public class MetaWebClientConfig {

    @Bean(name = "metaWebClient")
    public WebClient metaWebClient() {
        return WebClient.builder().build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
