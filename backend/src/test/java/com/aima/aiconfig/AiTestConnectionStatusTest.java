package com.aima.aiconfig;

import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.TestConnectionResultPayload;
import com.aima.entity.AiProvider;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTestStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.AiProviderRepository;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiServiceClient;
import com.aima.service.Impl.AiModelHealthServiceImpl;
import com.aima.mapper.AiConfigMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Kiểm tra kết nối" trả status theo classify_error của AI service (D):
 * - mỗi status lưu được vào ai_providers.last_test_status (cột 30 ký tự, gồm DAILY_QUOTA_EXHAUSTED);
 * - AI service cũ (chỉ success) → OK/FAILED; AI service không phản hồi → FAILED;
 * - cờ FreeTier: set khi test gặp 429 FreeTier hoặc khi llm_attempts báo free_tier; reset xoá cờ;
 * - dữ liệu cũ SUCCESS/FAILED vẫn đọc được.
 */
// H2 RIÊNG: context này bị DirtiesContext đóng lại → create-drop chỉ được xoá DB của chính nó,
// không được đụng H2 dùng chung "aima" của các test class khác.
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:aima_testconn;DB_CLOSE_DELAY=-1;INIT=CREATE DOMAIN IF NOT EXISTS JSONB AS JSON"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AiTestConnectionStatusTest {

    @MockitoBean private AiServiceClient aiServiceClient;
    @MockitoBean private AiModelHealthService modelHealthService;

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private AiProviderRepository providerRepository;

    private MockMvc mockMvc;
    private AiProvider google;

    private static RequestPostProcessor admin() {
        return user("admin@test.local").roles("ADMIN");
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        google = providerRepository.findByCodeAndDeletedAtIsNull(AiProviderCode.GOOGLE).orElseThrow();
        google.setApiKey("AIza-test-key-1234567");
        google.setFreeTierDetectedAt(null);
        google = providerRepository.save(google);
    }

    private static TestConnectionResultPayload result(boolean success, String status, boolean freeTier) {
        return TestConnectionResultPayload.builder().success(success).status(status).freeTier(freeTier)
                .message(success ? null : "provider said no").latencyMs(12L).build();
    }

    private AiProvider reload() {
        return providerRepository.findById(google.getId()).orElseThrow();
    }

    @ParameterizedTest
    @CsvSource({"OK,true", "INVALID_KEY,false", "RATE_LIMITED,false", "DAILY_QUOTA_EXHAUSTED,false",
            "PROVIDER_OVERLOADED,false", "NETWORK_ERROR,false", "FAILED,false"})
    void eachClassifiedStatusIsReturnedAndPersisted(String status, boolean success) throws Exception {
        when(aiServiceClient.testConnection(any())).thenReturn(result(success, status, false));
        if (success) {
            when(aiServiceClient.listModels(any())).thenThrow(new AppException(ErrorCode.AI_SERVICE_ERROR));
        }

        mockMvc.perform(post("/admin/ai/providers/" + google.getId() + "/test").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.status").value(status));

        assertEquals(AiTestStatus.valueOf(status), reload().getLastTestStatus());
    }

    @Test
    void legacyAiServiceWithoutStatusMapsToOkOrFailed_andUnreachableIsFailed() throws Exception {
        when(aiServiceClient.testConnection(any())).thenReturn(result(false, null, false));
        mockMvc.perform(post("/admin/ai/providers/" + google.getId() + "/test").with(admin()))
                .andExpect(jsonPath("$.result.status").value("FAILED"));

        when(aiServiceClient.testConnection(any())).thenThrow(new AppException(ErrorCode.AI_SERVICE_ERROR));
        mockMvc.perform(post("/admin/ai/providers/" + google.getId() + "/test").with(admin()))
                .andExpect(jsonPath("$.result.status").value("FAILED"));

        assertEquals(AiTestStatus.OK, AiTestStatus.fromAiService(null, true));
        assertEquals(AiTestStatus.FAILED, AiTestStatus.fromAiService("SOMETHING_NEW", false));
        assertTrue(AiTestStatus.DAILY_QUOTA_EXHAUSTED.keyValid());
        assertFalse(AiTestStatus.INVALID_KEY.keyValid());
    }

    @Test
    void freeTierFromTestIsFlagged_andResetClearsIt() throws Exception {
        when(aiServiceClient.testConnection(any())).thenReturn(result(false, "DAILY_QUOTA_EXHAUSTED", true));
        mockMvc.perform(post("/admin/ai/providers/" + google.getId() + "/test").with(admin()))
                .andExpect(jsonPath("$.result.freeTier").value(true));
        assertNotNull(reload().getFreeTierDetectedAt());

        mockMvc.perform(get("/admin/ai/providers").with(admin()))
                .andExpect(jsonPath("$.result[?(@.code == 'GOOGLE')].freeTierDetectedAt").isNotEmpty());

        when(modelHealthService.reset(anyString())).thenReturn(2);
        mockMvc.perform(post("/admin/ai/providers/" + google.getId() + "/reset-model-health").with(admin()))
                .andExpect(status().isOk());
        assertNull(reload().getFreeTierDetectedAt(), "reset phải xoá cờ FreeTier");
        verify(modelHealthService).reset("GOOGLE");
    }

    @Test
    void freeTierFromGenerationAttemptsIsFlaggedOnce() {
        // Service thật (không phải mock của context) — Redis mock: chỉ kiểm tra phần ghi cờ DB.
        StringRedisTemplate redis = mock(StringRedisTemplate.class, RETURNS_DEEP_STUBS);
        AiModelHealthServiceImpl health = new AiModelHealthServiceImpl(redis, JsonMapper.builder().build(),
                mock(AiConfigMapper.class), providerRepository);
        LlmAttemptPayload quota = LlmAttemptPayload.builder().provider("google").model("gemini-3.5-flash")
                .outcome("daily_quota_exhausted").freeTier(true).build();

        health.record(List.of(quota, quota));
        LocalDateTime first = reload().getFreeTierDetectedAt();
        assertNotNull(first);

        health.record(List.of(quota));
        assertEquals(first, reload().getFreeTierDetectedAt(), "đã đánh dấu thì không ghi đè mốc lần đầu");
    }

    @Test
    void legacyStatusValuesStillReadable() throws Exception {
        google.setLastTestStatus(AiTestStatus.SUCCESS);
        providerRepository.save(google);
        mockMvc.perform(get("/admin/ai/providers").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result[?(@.code == 'GOOGLE')].lastTestStatus").value("SUCCESS"));
        verify(aiServiceClient, never()).testConnection(eq(null));
    }
}
