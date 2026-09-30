package com.aima.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class IsolatedStackConfigTest {
    MockEnvironment environment() throws Exception {
        var env = new MockEnvironment();
        for (var source : new YamlPropertySourceLoader().load("isolated", new FileSystemResource("isolated/application.yml"))) {
            env.getPropertySources().addLast(source);
        }
        return env;
    }

    @Test void acceptsOnlyTheIsolatedConfiguration() throws Exception {
        assertDoesNotThrow(() -> IsolatedStackConfig.validate(environment()));
    }
    @Test void rejectsRemoteDatabaseBeforeBeansAreInstantiated() throws Exception {
        var env = environment().withProperty("spring.datasource.url", "jdbc:postgresql://example.invalid:5432/production");
        assertThrows(IllegalStateException.class, () -> IsolatedStackConfig.isolatedStackGuard(env));
    }
    @Test void rejectsRealPublisherAndEnvImportsAndAutomaticBaseline() throws Exception {
        var env = environment().withProperty("meta.graph-base-url", "https://graph.facebook.com");
        assertThrows(IllegalStateException.class, () -> IsolatedStackConfig.validate(env));
        var imports = environment().withProperty("spring.config.import", "optional:file:backend/.env[.properties]");
        assertThrows(IllegalStateException.class, () -> IsolatedStackConfig.validate(imports));
        var baseline = environment().withProperty("spring.flyway.baseline-on-migrate", "true");
        assertThrows(IllegalStateException.class, () -> IsolatedStackConfig.validate(baseline));
    }
}
