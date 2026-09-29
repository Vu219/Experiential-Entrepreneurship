package com.aima.aiconfig;

import com.aima.config.AiServiceProperties;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmConfigPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.enums.AiTaskCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiProviderRepository;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.SystemLogService;
import com.aima.service.Impl.AiModelHealthServiceImpl;
import com.aima.service.Impl.AiServiceClientImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Circuit breaker model AI (Redis): đánh dấu nghỉ từ llm_attempts, bỏ model đang nghỉ khỏi chuỗi,
 * FAIL-OPEN khi Redis lỗi, và backend ghi nhận vết từ cả response thành công lẫn 502.
 */
class AiModelHealthTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> ops;
    private AiConfigMapper mapper;
    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private AiModelHealthServiceImpl health;

    private final LlmSpecPayload primary = LlmSpecPayload.builder().provider("google").model("gemini-3.5-flash").apiKey("k").build();
    private final LlmSpecPayload fallback = LlmSpecPayload.builder().provider("google").model("gemini-3.1-flash-lite").apiKey("k").build();
    private final LlmConfigPayload config = LlmConfigPayload.builder().primary(primary).fallback(fallback).build();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        mapper = mock(AiConfigMapper.class);
        when(mapper.toLlmConfig(any(), any())).thenCallRealMethod(); // default method — dựng fallback + fallbacks
        health = new AiModelHealthServiceImpl(redis, objectMapper, mapper, mock(AiProviderRepository.class));
    }

    private static LlmAttemptPayload attempt(String model, String outcome, Instant until) {
        return LlmAttemptPayload.builder().provider("google").model(model).outcome(outcome)
                .cooldownUntil(until).freeTier(true).build();
    }

    @Test
    void dailyQuota_marksExhaustedWithTtlUntilReset_okClearsMark() {
        Instant reset = Instant.now().plus(Duration.ofHours(5));
        health.record(List.of(attempt("gemini-3.5-flash", "daily_quota_exhausted", reset),
                attempt("gemini-3.1-flash-lite", "ok", null)));

        verify(ops).set(eq("ai:model-health:google:gemini-3.5-flash"),
                argThat(json -> json.contains("\"state\":\"EXHAUSTED\"") && json.contains("\"freeTier\":true")),
                argThat((Duration ttl) -> ttl.toMinutes() >= 299 && ttl.toMinutes() <= 300));
        verify(redis).delete("ai:model-health:google:gemini-3.1-flash-lite");
    }

    @Test
    void attemptWithoutCooldown_isNotMarked() {
        health.record(List.of(attempt("gemini-3.5-flash", "invalid_key", null)));
        verify(ops, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void coolingPrimaryIsSkipped_fallbackBecomesPrimary() {
        when(ops.multiGet(anyList())).thenReturn(Arrays.asList("{\"state\":\"EXHAUSTED\"}", null));

        LlmConfigPayload filtered = health.filterAvailable(config);

        assertEquals("gemini-3.1-flash-lite", filtered.getPrimary().getModel());
        assertNull(filtered.getFallback());
        assertSame(primary, config.getPrimary(), "cached config must not be mutated");
    }

    @Test
    void multiModelChain_skipsRestingMiddleModel_keepsOrder() {
        LlmSpecPayload flash25 = LlmSpecPayload.builder().provider("google").model("gemini-2.5-flash").apiKey("k").build();
        LlmSpecPayload claude = LlmSpecPayload.builder().provider("anthropic").model("claude-sonnet-4-6").apiKey("k").build();
        LlmConfigPayload chain = mapper.toLlmConfig(primary, List.of(fallback, flash25, claude));
        when(ops.multiGet(anyList())).thenReturn(Arrays.asList(null, "{\"state\":\"COOLDOWN\"}", null, null));

        LlmConfigPayload filtered = health.filterAvailable(chain);

        verify(ops).multiGet(List.of("ai:model-health:google:gemini-3.5-flash",
                "ai:model-health:google:gemini-3.1-flash-lite", "ai:model-health:google:gemini-2.5-flash",
                "ai:model-health:anthropic:claude-sonnet-4-6"));
        assertEquals("gemini-3.5-flash", filtered.getPrimary().getModel());
        assertEquals(List.of("gemini-2.5-flash", "claude-sonnet-4-6"),
                filtered.getFallbacks().stream().map(LlmSpecPayload::getModel).toList());
        assertEquals("gemini-2.5-flash", filtered.getFallback().getModel(), "legacy fallback = fallbacks[0]");
        assertEquals(3, chain.getFallbacks().size(), "cached config must not be mutated");
    }

    @Test
    void allModelsCooling_sendsFullChain() {
        when(ops.multiGet(anyList())).thenReturn(List.of("{}", "{}"));
        assertSame(config, health.filterAvailable(config));
    }

    @Test
    void redisDown_failsOpen_andBacksOffWithoutHittingRedisAgain() {
        when(ops.multiGet(anyList())).thenThrow(new RedisConnectionFailureException("down"));

        assertSame(config, health.filterAvailable(config));          // fail-open
        assertDoesNotThrow(() -> health.record(List.of(
                attempt("gemini-3.5-flash", "provider_overloaded", Instant.now().plusSeconds(60)))));
        assertEquals(List.of(), health.list());
        assertSame(config, health.filterAvailable(config));
        verify(ops, times(1)).multiGet(anyList());                    // backoff: Redis hit only once
        verify(ops, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void resetWhenRedisDown_reportsError() {
        when(redis.scan(any())).thenThrow(new RedisConnectionFailureException("down"));
        AppException e = assertThrows(AppException.class, () -> health.reset("GOOGLE"));
        assertEquals(ErrorCode.AI_MODEL_HEALTH_UNAVAILABLE, e.getErrorCode());
    }

    // ---- AiServiceClient: ghi nhận vết từ response thành công và từ 502 của chuỗi fallback ----

    private AiServiceClientImpl client(HttpStatus status, String body, AiModelHealthService healthService,
                                       List<LlmConfigPayload> sentConfigs) {
        WebClient webClient = WebClient.builder().exchangeFunction(req -> Mono.just(
                ClientResponse.create(status).header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(body).build())).build();
        AiRuntimeConfigService runtime = mock(AiRuntimeConfigService.class);
        when(runtime.getLlmConfig(AiTaskCode.CONTENT_GENERATION)).thenReturn(config);
        when(healthService.filterAvailable(config)).thenAnswer(inv -> {
            sentConfigs.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        return new AiServiceClientImpl(webClient, new AiServiceProperties("http://ai", 5, null),
                mock(SystemLogService.class), runtime, healthService, objectMapper);
    }

    @Test
    void successResponse_recordsAttempts_andRoutingIsFiltered() {
        AiModelHealthService healthService = mock(AiModelHealthService.class);
        List<LlmConfigPayload> sent = new ArrayList<>();
        String body = "{\"caption\":\"c\",\"tokens_used\":3,\"llm_attempts\":["
                + "{\"provider\":\"google\",\"model\":\"gemini-3.5-flash\",\"outcome\":\"daily_quota_exhausted\","
                + "\"cooldown_until\":\"2030-01-01T08:00:00Z\",\"free_tier\":true},"
                + "{\"provider\":\"google\",\"model\":\"gemini-3.1-flash-lite\",\"outcome\":\"ok\"}]}";

        client(HttpStatus.OK, body, healthService, sent).generateContent(new GenerateContentPayload());

        assertEquals(1, sent.size());
        verify(healthService).record(argThat(list -> list.size() == 2
                && "daily_quota_exhausted".equals(list.get(0).getOutcome())
                && Instant.parse("2030-01-01T08:00:00Z").equals(list.get(0).getCooldownUntil())));
    }

    @Test
    void failedChain502_recordsAttempts_thenThrows() {
        AiModelHealthService healthService = mock(AiModelHealthService.class);
        String body = "{\"detail\":{\"error_code\":\"AI_PROVIDER_OVERLOADED\",\"message\":\"x\",\"attempts\":["
                + "{\"provider\":\"google\",\"model\":\"gemini-3.1-flash-lite\",\"outcome\":\"provider_overloaded\","
                + "\"cooldown_until\":\"2030-01-01T08:00:00Z\"}]}}";

        AiServiceClientImpl c = client(HttpStatus.BAD_GATEWAY, body, healthService, new ArrayList<>());
        AppException e = assertThrows(AppException.class, () -> c.generateContent(new GenerateContentPayload()));
        assertEquals(ErrorCode.AI_PROVIDER_OVERLOADED, e.getErrorCode(), "error_code của chuỗi → ErrorCode cùng tên (worker lưu vào job)");

        verify(healthService).record(argThat(list -> list.size() == 1
                && "provider_overloaded".equals(list.get(0).getOutcome())));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
            "AI_PROVIDER_OVERLOADED,AI_PROVIDER_OVERLOADED", "AI_QUOTA_EXHAUSTED,AI_QUOTA_EXHAUSTED",
            "AI_TIMEOUT,AI_TIMEOUT", "AI_BAD_REQUEST,AI_BAD_REQUEST", "AI_UNAVAILABLE,AI_UNAVAILABLE",
            "SOMETHING_ELSE,AI_SERVICE_ERROR"})
    void failedChainErrorCodeMapsToBackendErrorCode(String aiCode, ErrorCode expected) {
        AiModelHealthService healthService = mock(AiModelHealthService.class);
        String body = "{\"detail\":{\"error_code\":\"" + aiCode + "\",\"message\":\"x\",\"attempts\":[]}}";
        AiServiceClientImpl c = client(HttpStatus.BAD_GATEWAY, body, healthService, new ArrayList<>());
        AppException e = assertThrows(AppException.class, () -> c.generateContent(new GenerateContentPayload()));
        assertEquals(expected, e.getErrorCode());
    }

    @Test
    void non502ChainBody_isGenericAiServiceError() {
        AiModelHealthService healthService = mock(AiModelHealthService.class);
        AiServiceClientImpl c = client(HttpStatus.SERVICE_UNAVAILABLE, "{\"detail\":\"llm config error\"}", healthService, new ArrayList<>());
        AppException e = assertThrows(AppException.class, () -> c.generateContent(new GenerateContentPayload()));
        assertEquals(ErrorCode.AI_SERVICE_ERROR, e.getErrorCode());
    }
}
