package com.aima.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Arrays;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Executor riêng cho các tác vụ AI chạy nền (NFR-04) — tách khỏi executor mặc định của Spring
 * để không tranh chấp tài nguyên với các @Async khác (nếu có sau này).
 */
@Configuration
@Slf4j
public class AsyncConfig implements AsyncConfigurer {

    /**
     * Lưới an toàn cuối cho mọi {@code @Async void}: exception lọt khỏi worker mặc định chỉ được
     * Spring log ở mức thấp, dễ trôi mất — log ERROR đủ stacktrace + tên method + tham số (thường là
     * jobId, không chứa token). Worker vẫn phải tự catch để cập nhật trạng thái job (rule #28e).
     */
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> log.error("[Async] {}.{}({}) ném exception không được xử lý",
                method.getDeclaringClass().getSimpleName(), method.getName(), Arrays.toString(params), ex);
    }

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

    @Bean(name = "postPublishExecutor")
    public Executor postPublishExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("post-publish-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "contentRegenerationExecutor")
    public Executor contentRegenerationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("content-regen-");
        executor.initialize();
        return executor;
    }

    @Bean(name = "strategyOptimizationExecutor")
    public Executor strategyOptimizationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("strategy-opt-");
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

    /**
     * Ghi activity log — tác vụ RẤT ngắn (1 insert) nhưng tần suất cao, nên hàng đợi rộng và
     * pool nhỏ. {@code CallerRunsPolicy}: khi hàng đợi đầy thì ghi ngay trên thread gọi thay vì
     * ném RejectedExecutionException — thà request chậm vài ms còn hơn MẤT dấu vết audit.
     */
    @Bean(name = "activityLogExecutor")
    public Executor activityLogExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(3);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("activity-log-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    /**
     * Xử lý sự kiện webhook Meta (analytics giai đoạn 3) — mỗi sự kiện vài câu UPDATE. Hàng đợi đầy thì TỪ CHỐI (không
     * chạy trên thread request): sự kiện đã lưu PENDING, {@code MetaWebhookEventJob} quét lại sau ~2 phút.
     */
    @Bean(name = "metaWebhookExecutor")
    public Executor metaWebhookExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("meta-webhook-");
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
