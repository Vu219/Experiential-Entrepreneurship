package com.aima.config;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import java.net.URI;
import java.util.List;

/** Fail before Flyway/DataSource instantiation if the isolated launch is misconfigured. */
@Configuration
@Profile("isolated")
public class IsolatedStackConfig {
    @Bean
    static BeanFactoryPostProcessor isolatedStackGuard(Environment environment) {
        validate(environment);
        return beanFactory -> { };
    }

    public static void validate(Environment env) {
        require("jdbc:postgresql://127.0.0.1:55432/aima_isolated".equals(env.getProperty("spring.datasource.url")), "database");
        require("aima_isolated".equals(env.getProperty("spring.datasource.username")), "database user");
        require(env.getProperty("spring.flyway.url", "").isBlank(), "separate Flyway datasource");
        require(env.getProperty("spring.datasource.hikari.jdbc-url", "").isBlank(), "Hikari URL override");
        require(env.getProperty("spring.config.import", "").isBlank(), "config imports");
        require("8092".equals(env.getProperty("server.port")), "backend port");
        require("127.0.0.1".equals(env.getProperty("spring.data.redis.host"))
                && "56379".equals(env.getProperty("spring.data.redis.port")), "Redis");
        require("mock".equals(env.getProperty("payment.gateway")), "payment gateway");
        require(!env.getProperty("aima.production-mode", Boolean.class, false), "production mode");
        require(!env.getProperty("spring.flyway.baseline-on-migrate", Boolean.class, false), "automatic baseline");
        require(!env.getProperty("app.scheduling.enabled", Boolean.class, true), "automatic scheduling");
        for (String key : List.of("meta.graph-base-url", "meta.threads-base-url", "ai-service.base-url",
                "supabase.url", "brevo.api-url", "payos.base-url")) {
            URI uri = URI.create(env.getRequiredProperty(key));
            require("http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost())
                    && uri.getPort() == 58080 && uri.getUserInfo() == null, key);
        }
    }

    private static void require(boolean condition, String property) {
        if (!condition) throw new IllegalStateException("Unsafe isolated stack configuration: " + property);
    }
}
