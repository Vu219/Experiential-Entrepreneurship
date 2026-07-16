package com.aima.aiconfig;

import com.aima.dto.ai.LlmConfigPayload;
import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.repository.AiProviderRepository;
import com.aima.service.AiRuntimeConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Resolve routing runtime khi AI_CONFIG_FROM_DB=true (seed mặc định: routing đủ 6 task,
 * primary Anthropic, fallback Google, provider đều DISABLED):
 * - provider tắt / thiếu key → null (rơi về env, không kích hoạt gì ngoài ý muốn);
 * - provider bật + có key → payload đúng provider/model/key, fallback chỉ xuất hiện
 *   khi provider fallback cũng hiệu lực; evictCache áp dụng thay đổi ngay.
 */
@SpringBootTest(properties = "ai-config.from-db=true")
class AiRuntimeConfigTest {

    private static final String KEY = "sk-runtime-test-key-123456";

    @Autowired
    private AiRuntimeConfigService runtimeConfigService;

    @Autowired
    private AiProviderRepository providerRepository;

    private AiProvider provider(AiProviderCode code) {
        return providerRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow();
    }

    private void setProvider(AiProviderCode code, boolean enabled, String apiKey) {
        AiProvider provider = provider(code);
        provider.setEnabled(enabled);
        provider.setApiKey(apiKey);
        providerRepository.save(provider);
    }

    @Test
    void returnsNullWhileProvidersDisabled() {
        setProvider(AiProviderCode.ANTHROPIC, false, null);
        setProvider(AiProviderCode.GOOGLE, false, null);
        runtimeConfigService.evictCache();

        assertNull(runtimeConfigService.getLlmConfig(AiTaskCode.CONTENT_GENERATION),
                "Provider tắt/thiếu key → không được sinh llm_config");
        assertNull(runtimeConfigService.getActiveModel(AiTaskCode.CONTENT_GENERATION));
    }

    @Test
    void resolvesPrimaryAndFallbackByProviderState() {
        // Chỉ bật ANTHROPIC → primary có, fallback (Google tắt) phải bị loại.
        setProvider(AiProviderCode.ANTHROPIC, true, KEY);
        setProvider(AiProviderCode.GOOGLE, false, null);
        runtimeConfigService.evictCache();

        LlmConfigPayload config = runtimeConfigService.getLlmConfig(AiTaskCode.CONTENT_GENERATION);
        assertNotNull(config, "Provider bật + có key → phải sinh llm_config");
        assertEquals("anthropic", config.getPrimary().getProvider());
        assertEquals("claude-sonnet-4-6", config.getPrimary().getModel());
        assertEquals(KEY, config.getPrimary().getApiKey());
        assertEquals(16000, config.getPrimary().getMaxTokens());
        assertNull(config.getFallback(), "Provider fallback đang tắt → không được kèm fallback");

        AiRuntimeConfigService.ActiveModel active =
                runtimeConfigService.getActiveModel(AiTaskCode.CONTENT_GENERATION);
        assertNotNull(active);
        assertEquals(AiProviderCode.ANTHROPIC, active.providerCode());

        // Bật thêm GOOGLE + evict → fallback xuất hiện ngay (không đợi TTL 5 phút).
        setProvider(AiProviderCode.GOOGLE, true, KEY);
        runtimeConfigService.evictCache();

        LlmConfigPayload withFallback = runtimeConfigService.getLlmConfig(AiTaskCode.CONTENT_GENERATION);
        assertNotNull(withFallback.getFallback(), "Provider fallback bật → phải kèm fallback");
        assertEquals("google", withFallback.getFallback().getProvider());
        assertEquals("gemini-2.5-pro", withFallback.getFallback().getModel());
    }
}
