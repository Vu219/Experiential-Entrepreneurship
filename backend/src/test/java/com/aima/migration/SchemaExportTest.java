package com.aima.migration;

import jakarta.persistence.Entity;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.nio.file.Files;
import java.nio.file.Path;

/** Offline maintainer tool: export mappings without starting Spring or opening a database. */
@EnabledIfSystemProperty(named = "schema.export", matches = "true")
class SchemaExportTest {
    @Test
    void export() throws Exception {
        Path output = Path.of("target", "schema-export.sql");
        Files.deleteIfExists(output);
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", false)
                .applySetting("hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl")
                .applySetting("jakarta.persistence.schema-generation.database.action", "none")
                .applySetting("jakarta.persistence.schema-generation.scripts.action", "create")
                .applySetting("jakarta.persistence.schema-generation.scripts.create-target", output.toString())
                .applySetting("hibernate.hbm2ddl.delimiter", ";")
                .build();
        try {
            var sources = new MetadataSources(registry);
            for (var resource : new PathMatchingResourcePatternResolver()
                    .getResources("classpath*:com/aima/entity/*.class")) {
                String filename = resource.getFilename();
                Class<?> type = Class.forName("com.aima.entity." + filename.substring(0, filename.length() - 6));
                if (type.isAnnotationPresent(Entity.class)) sources.addAnnotatedClass(type);
            }
            try (var factory = sources.buildMetadata().buildSessionFactory()) {
                org.junit.jupiter.api.Assertions.assertTrue(Files.size(output) > 1000);
            }
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
    }
}
