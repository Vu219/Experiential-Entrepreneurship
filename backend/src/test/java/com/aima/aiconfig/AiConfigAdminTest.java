package com.aima.aiconfig;

import com.aima.entity.AiConfigAudit;
import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.repository.AiConfigAuditRepository;
import com.aima.repository.AiProviderRepository;
import com.aima.service.AiRuntimeConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bảo mật cấu hình AI (SEC-03):
 * (a) response provider chỉ chứa key MASKED, không bao giờ lộ full key;
 * (b) key round-trip qua EncryptedStringConverter — DB chỉ chứa ciphertext;
 * (c) endpoint đọc/ghi bị chặn khi thiếu quyền (anonymous 401, USER 403);
 * (d) audit snapshot không bao giờ chứa key plaintext.
 *
 * <p>MockMvc dựng thủ công với {@code apply(springSecurity())} + post-processor
 * {@code user(...).roles(...)} — không dùng {@code @WithMockUser} vì security context
 * của listener bị SecurityContextHolderFilter (STATELESS) ghi đè trong môi trường test.</p>
 */
@SpringBootTest
class AiConfigAdminTest {

    private static final String SECRET_KEY = "sk-test-plaintext-key-abcdef-7890";
    private static final String MASKED_KEY = "••••7890";

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AiProviderRepository providerRepository;

    @Autowired
    private AiConfigAuditRepository auditRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AiRuntimeConfigService runtimeConfigService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
    }

    private static RequestPostProcessor asUser() {
        return SecurityMockMvcRequestPostProcessors.user("user@test.local").roles("USER");
    }

    private static RequestPostProcessor asAdmin() {
        return SecurityMockMvcRequestPostProcessors.user("admin@test.local").roles("ADMIN");
    }

    private AiProvider provider(AiProviderCode code) {
        return providerRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
    }

    // ===== (c) RBAC =====

    @Test
    void readRejectsAnonymous() throws Exception {
        mockMvc.perform(get("/admin/ai/providers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void readRejectsNonAdmin() throws Exception {
        mockMvc.perform(get("/admin/ai/providers").with(asUser()))
                .andExpect(status().isForbidden());
    }

    @Test
    void writeKeyRejectsNonAdmin() throws Exception {
        mockMvc.perform(put("/admin/ai/providers/" + UUID.randomUUID())
                        .with(asUser())
                        .contentType(APPLICATION_JSON)
                        .content("{\"apiKey\":\"" + SECRET_KEY + "\"}"))
                .andExpect(status().isForbidden());
    }

    // ===== (a) Response không lộ full key =====

    @Test
    void listProvidersReturnsMaskedKeyOnly() throws Exception {
        AiProvider anthropic = provider(AiProviderCode.ANTHROPIC);
        anthropic.setApiKey(SECRET_KEY);
        providerRepository.save(anthropic);

        String body = mockMvc.perform(get("/admin/ai/providers").with(asAdmin()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertFalse(body.contains(SECRET_KEY), "Response không được chứa API key plaintext");
        assertTrue(body.contains(MASKED_KEY), "Response phải chứa key dạng masked");
    }

    // ===== (b) Round-trip mã hóa: DB chỉ chứa ciphertext =====

    @Test
    void keyIsEncryptedAtRestAndRoundTrips() {
        AiProvider google = provider(AiProviderCode.GOOGLE);
        google.setApiKey(SECRET_KEY);
        providerRepository.save(google);

        String rawColumn = jdbcTemplate.queryForObject(
                "SELECT api_key FROM ai_providers WHERE code = 'GOOGLE'", String.class);
        assertNotNull(rawColumn, "Cột api_key phải có ciphertext");
        assertFalse(rawColumn.contains(SECRET_KEY), "DB không được chứa key plaintext");

        AiProvider reloaded = provider(AiProviderCode.GOOGLE);
        assertEquals(SECRET_KEY, reloaded.getApiKey(), "Đọc lại qua converter phải ra đúng key gốc");
    }

    // ===== Rollback: flag AI_CONFIG_FROM_DB tắt (mặc định) =====

    @Test
    void flagOffNeverInjectsLlmConfig() {
        // Context này chạy from-db=false (mặc định): kể cả provider bật + có key,
        // runtime KHÔNG được sinh llm_config — hành vi env giữ nguyên tuyệt đối.
        AiProvider anthropic = provider(AiProviderCode.ANTHROPIC);
        anthropic.setApiKey(SECRET_KEY);
        anthropic.setEnabled(true);
        providerRepository.save(anthropic);
        runtimeConfigService.evictCache();

        assertFalse(java.util.Arrays.stream(AiTaskCode.values())
                        .anyMatch(task -> runtimeConfigService.getLlmConfig(task) != null),
                "Flag tắt → không task nào được nhận llm_config");
    }

    // ===== (d) Audit snapshot chỉ lưu key đã mask =====

    @Test
    void auditSnapshotNeverStoresPlaintextKey() throws Exception {
        UUID providerId = provider(AiProviderCode.ANTHROPIC).getId();

        mockMvc.perform(put("/admin/ai/providers/" + providerId)
                        .with(asAdmin())
                        .contentType(APPLICATION_JSON)
                        .content("{\"apiKey\":\"" + SECRET_KEY + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.apiKeyMasked").value(MASKED_KEY));

        var entries = auditRepository.findAll();
        assertFalse(entries.isEmpty(), "Mutation phải sinh audit log");
        for (AiConfigAudit entry : entries) {
            String snapshots = entry.getBeforeSnapshot() + "|" + entry.getAfterSnapshot();
            assertFalse(snapshots.contains(SECRET_KEY), "Audit snapshot không được chứa key plaintext");
        }
    }
}
