package com.aima.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.Executor;

/**
 * Executor riêng cho các tác vụ AI chạy nền (NFR-04) — tách khỏi executor mặc định của Spring
 * để không tranh chấp tài nguyên với các @Async khác (nếu có sau này).
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "contentGenerationExecutor")
    public Executor contentGenerationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("content-gen-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "contentFormattingExecutor")
    public Executor contentFormattingExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(3);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("content-fmt-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "trendResearchExecutor")
    public Executor trendResearchExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(3);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("trend-research-");
        executor.initialize();
        return executor;
    }

    // Dùng cho các transaction ngắn quanh phần ghi DB của tác vụ nền, để cuộc gọi AI chạy NGOÀI
    // transaction (rule #24) — xem ContentGenerationWorkerImpl.
    @Bean
    public TransactionTemplate transactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }
}
