package com.aima.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * ShedLock: mỗi {@code @Scheduled} gắn {@code @SchedulerLock} chỉ chạy trên MỘT instance tại một
 * thời điểm (khoá theo tên trong bảng {@code shedlock}). Thiếu nó, chạy ≥2 instance sẽ nhân đôi
 * mọi job — quét lịch đăng, trừ hạn mức, gửi email cảnh báo xoá tài khoản...
 *
 * <p>Bảng do Flyway tạo trước khi khởi động ứng dụng. Giờ khoá lấy theo đồng hồ DB ({@code usingDbTime}) để các instance
 * lệch giờ vẫn khoá đúng.</p>
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class SchedulerLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(jdbcTemplate)
                .usingDbTime()
                .build());
    }
}
