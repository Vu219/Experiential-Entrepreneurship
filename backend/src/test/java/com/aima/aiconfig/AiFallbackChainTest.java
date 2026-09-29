package com.aima.aiconfig;

import com.aima.config.init.AiConfigDataInitializer;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmConfigPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.entity.AiModel;
import com.aima.entity.AiProvider;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiUsage;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiProviderRepository;
import com.aima.repository.AiTaskRoutingRepository;
import com.aima.repository.AiUsageRepository;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Chuỗi fallback nhiều model (ai_task_routing_fallback):
 * - PUT routing lưu đúng thứ tự, đổi thứ tự không vỡ unique, chặn trùng/chứa model chính/quá dài;
 * - client cũ chỉ gửi fallbackModelId vẫn chạy; cột legacy luôn = position 0;
 * - runtime gửi đủ chuỗi theo thứ tự, bỏ model thuộc provider tắt; payload có cả fallback legacy;
 * - migration khởi động: routing chỉ có fallback_model_id → position 0;
 * - model đang nằm trong chuỗi (position > 0) không xoá được;
 * - usage tính theo model THỰC SỰ trả lời (attempt "ok"), lưu kèm model chính.
 * Context riêng + DirtiesContext: test sửa routing dùng chung, không được rò sang class khác.
 */
// H2 RIÊNG: context này bị DirtiesContext đóng lại → create-drop chỉ được xoá DB của chính nó,
// không được đụng H2 dùng chung "aima" của các test class khác.
@SpringBootTest(properties = {"ai-config.from-db=true",
        "spring.datasource.url=jdbc:h2:mem:aima_fallback;DB_CLOSE_DELAY=-1;INIT=CREATE DOMAIN IF NOT EXISTS JSONB AS JSON"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AiFallbackChainTest {

    private static final String KEY = "sk-fallback-chain-test-key-1234";
    private static final AiTaskCode TASK = AiTaskCode.CONTENT_GENERATION;

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private AiProviderRepository providerRepository;
    @Autowired private AiModelRepository modelRepository;
    @Autowired private AiTaskRoutingRepository routingRepository;
    @Autowired private AiUsageRepository usageRepository;
    @Autowired private AiRuntimeConfigService runtimeConfigService;
    @Autowired private AiUsageService aiUsageService;
    @Autowired private AiConfigDataInitializer initializer;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;

    private MockMvc mockMvc;
    private AiModel flash;
    private AiModel lite;
    private AiModel flash25;
    private AiModel claude;
    private UUID routingId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        AiProvider google = enable(AiProviderCode.GOOGLE, true);
        enable(AiProviderCode.ANTHROPIC, true);
        flash = model(google, "gemini-3.5-flash", "0.50", "3.00");
        lite = model(google, "gemini-3.1-flash-lite", "0.10", "0.40");
        flash25 = model(google, "gemini-2.5-flash", "0.30", "2.50");
        claude = modelRepository.findByProviderAndModelCodeAndDeletedAtIsNull(
                providerRepository.findByCodeAndDeletedAtIsNull(AiProviderCode.ANTHROPIC).orElseThrow(),
                "claude-sonnet-4-6").orElseThrow();
        routingId = routingRepository.findByTaskCodeAndDeletedAtIsNull(TASK).orElseThrow().getId();
        runtimeConfigService.evictCache();
    }

    private AiProvider enable(AiProviderCode code, boolean enabled) {
        AiProvider provider = providerRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
        provider.setEnabled(enabled);
        provider.setApiKey(KEY);
        return providerRepository.save(provider);
    }

    private AiModel model(AiProvider provider, String code, String in, String out) {
        return modelRepository.findByProviderAndModelCodeAndDeletedAtIsNull(provider, code)
                .orElseGet(() -> modelRepository.save(AiModel.builder().provider(provider).modelCode(code)
                        .displayName(code).enabled(true)
                        .inputPricePer1m(new BigDecimal(in)).outputPricePer1m(new BigDecimal(out)).build()));
    }

    private static RequestPostProcessor admin() {
        return user("admin@test.local").roles("ADMIN");
    }

    private static String ids(AiModel... models) {
        return java.util.Arrays.stream(models).map(m -> "\"" + m.getId() + "\"").collect(Collectors.joining(",", "[", "]"));
    }

    private org.springframework.test.web.servlet.ResultActions putRouting(String body) throws Exception {
        return mockMvc.perform(put("/admin/ai/routing/" + routingId).with(admin())
                .contentType(APPLICATION_JSON).content(body));
    }

    private String chainBody(AiModel primary, AiModel... fallbacks) {
        return "{\"primaryModelId\":\"" + primary.getId() + "\",\"fallbackModelIds\":" + ids(fallbacks)
                + ",\"maxTokens\":16000,\"enabled\":true}";
    }

    private static List<String> models(LlmConfigPayload config) {
        return config.getFallbacks().stream().map(LlmSpecPayload::getModel).toList();
    }

    @Test
    void savesOrderedChain_runtimeSendsItInOrder_andSkipsDisabledProvider() throws Exception {
        putRouting(chainBody(flash, lite, flash25, claude))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.fallbacks.length()").value(3))
                .andExpect(jsonPath("$.result.fallbacks[0].modelCode").value("gemini-3.1-flash-lite"))
                .andExpect(jsonPath("$.result.fallbacks[1].modelCode").value("gemini-2.5-flash"))
                .andExpect(jsonPath("$.result.fallbacks[2].modelCode").value("claude-sonnet-4-6"))
                .andExpect(jsonPath("$.result.fallbacks[2].position").value(2))
                // Legacy fields = mắt xích đầu (client/backend cũ vẫn đọc được)
                .andExpect(jsonPath("$.result.fallbackModelCode").value("gemini-3.1-flash-lite"));

        LlmConfigPayload config = runtimeConfigService.getLlmConfig(TASK);
        assertEquals("gemini-3.5-flash", config.getPrimary().getModel());
        assertEquals(List.of("gemini-3.1-flash-lite", "gemini-2.5-flash", "claude-sonnet-4-6"), models(config));
        assertEquals("gemini-3.1-flash-lite", config.getFallback().getModel(), "fallback legacy = fallbacks[0]");

        // Anthropic tắt → Claude bị bỏ khỏi chuỗi, phần còn lại giữ thứ tự.
        enable(AiProviderCode.ANTHROPIC, false);
        runtimeConfigService.evictCache();
        assertEquals(List.of("gemini-3.1-flash-lite", "gemini-2.5-flash"), models(runtimeConfigService.getLlmConfig(TASK)));
    }

    @Test
    void reorderingChainDoesNotBreakUniqueConstraints() throws Exception {
        putRouting(chainBody(flash, lite, flash25)).andExpect(status().isOk());
        putRouting(chainBody(flash, flash25, lite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.fallbacks[0].modelCode").value("gemini-2.5-flash"))
                .andExpect(jsonPath("$.result.fallbacks[1].modelCode").value("gemini-3.1-flash-lite"));
        putRouting(chainBody(flash)).andExpect(status().isOk())
                .andExpect(jsonPath("$.result.fallbacks.length()").value(0))
                .andExpect(jsonPath("$.result.fallbackModelId").doesNotExist());
    }

    @Test
    void rejectsDuplicateOrPrimaryInChainAndTooLongChain() throws Exception {
        putRouting(chainBody(flash, lite, lite)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(2047));
        putRouting(chainBody(flash, lite, flash)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(2047));
        String six = "[" + String.join(",", java.util.Collections.nCopies(6, "\"" + UUID.randomUUID() + "\"")) + "]";
        putRouting("{\"primaryModelId\":\"" + flash.getId() + "\",\"fallbackModelIds\":" + six + ",\"enabled\":true}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(2048));
    }

    @Test
    void legacyClientSendingSingleFallbackStillWorks() throws Exception {
        putRouting("{\"primaryModelId\":\"" + flash.getId() + "\",\"fallbackModelId\":\"" + lite.getId()
                + "\",\"enabled\":true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.fallbacks.length()").value(1))
                .andExpect(jsonPath("$.result.fallbacks[0].modelCode").value("gemini-3.1-flash-lite"));
    }

    @Test
    void modelInsideChainCannotBeDeleted() throws Exception {
        putRouting(chainBody(flash, lite, flash25)).andExpect(status().isOk());
        mockMvc.perform(delete("/admin/ai/models/" + flash25.getId()).with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(2015));
    }

    @Test
    void startupMigratesLegacyFallbackColumnToPositionZero() throws Exception {
        putRouting(chainBody(flash)).andExpect(status().isOk());
        // Dữ liệu kiểu cũ: chỉ có fallback_model_id, chưa có dòng chuỗi.
        jdbcTemplate.update("DELETE FROM ai_task_routing_fallback WHERE routing_id = ?", routingId);
        jdbcTemplate.update("UPDATE ai_task_routing SET fallback_model_id = ? WHERE id = ?", lite.getId(), routingId);

        initializer.run();
        initializer.run(); // idempotent

        List<String> chain = transactionTemplate.execute(tx -> {
            AiTaskRouting r = routingRepository.findById(routingId).orElseThrow();
            return r.getFallbacks().stream().map(f -> f.getPosition() + ":" + f.getModel().getModelCode()).toList();
        });
        assertEquals(List.of("0:gemini-3.1-flash-lite"), chain);
    }

    @Test
    void usageIsChargedToTheModelThatAnswered() throws Exception {
        putRouting(chainBody(flash, lite, flash25)).andExpect(status().isOk());
        runtimeConfigService.evictCache();
        UUID requestId = UUID.randomUUID();

        GeneratedContentResult result = new GeneratedContentResult();
        result.setTokensUsed(1_500_000L);
        result.setInputTokens(1_000_000L);
        result.setOutputTokens(500_000L);
        result.setLlmAttempts(List.of(
                LlmAttemptPayload.builder().provider("google").model("gemini-3.5-flash").outcome("daily_quota_exhausted").build(),
                LlmAttemptPayload.builder().provider("google").model("gemini-3.1-flash-lite").outcome("ok").build()));
        aiUsageService.recordCall(new AiUsageService.AiCallContext(null, TASK, requestId, null, null, null, null),
                () -> result);

        AiUsage usage = usageRepository.findAll().stream()
                .filter(u -> requestId.equals(u.getRequestId())).findFirst().orElseThrow();
        assertEquals(AiProviderCode.GOOGLE, usage.getProviderCode());
        assertEquals("gemini-3.1-flash-lite", usage.getModelCode(), "model thực sự trả lời");
        assertEquals("gemini-3.5-flash", usage.getRoutedModelCode(), "model chính theo routing");
        // Đơn giá lite: 1M in × $0.10 + 0.5M out × $0.40 = $0.30 (không phải giá model chính).
        assertNotNull(usage.getEstimatedCost());
        assertEquals(0, new BigDecimal("0.30").compareTo(usage.getEstimatedCost()));
    }
}
