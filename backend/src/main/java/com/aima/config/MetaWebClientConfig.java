package com.aima.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.channel.ChannelOption;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * WebClient & ObjectMapper dùng chung cho các service Meta API (Graph + Threads).
 * Base URL theo từng nền tảng được truyền lúc gọi (.uri()) nên client ở đây không gắn cứng base URL.
 */
@Configuration
@EnableConfigurationProperties({MetaProperties.class, AimaProperties.class})
public class MetaWebClientConfig {

    // Timeout tường minh: không có nó, một lần Graph treo giữ thread worker đăng bài vô hạn
    // (job kẹt RUNNING). Hết timeout khi đăng bài → lỗi mạng → TEMPORARY → retry (FR-56).
    @Bean(name = "metaWebClient")
    public WebClient metaWebClient(@Value("${meta.connect-timeout-seconds:5}") int connectTimeoutSeconds,
                                   @Value("${meta.response-timeout-seconds:30}") int responseTimeoutSeconds) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS,
                        (int) Duration.ofSeconds(connectTimeoutSeconds).toMillis())
                .responseTimeout(Duration.ofSeconds(responseTimeoutSeconds));
        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
