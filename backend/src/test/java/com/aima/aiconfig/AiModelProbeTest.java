package com.aima.aiconfig;

import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.dto.ai.ProbeModelsPayload;
import com.aima.dto.ai.ProbeModelsResultPayload;
import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.response.AiModelProbeResponse;
import com.aima.entity.AiModel;
import com.aima.entity.AiProvider;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiTaskRoutingFallback;
import com.aima.enums.AiModelBlockReason;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.mapper.AiConfigMapperImpl;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiProviderRepository;
import com.aima.repository.AiTaskRoutingRepository;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiServiceClient;
import com.aima.service.NotificationService;
import com.aima.service.Impl.AiModelHealthServiceImpl;
import com.aima.service.Impl.AiModelProbeServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * "Kiểm tra model": probe đúng tập model đang định tuyến, ghi kết quả + đưa vào circuit breaker; model 404
 * (model_not_found) vào trạng thái UNAVAILABLE và báo admin bằng câu riêng (variant UNAVAILABLE).
 */
class AiModelProbeTest {

    private final AiProvider google = AiProvider.builder().code(AiProviderCode.GOOGLE).name("Google")
            .apiKey("k-google").enabled(true).build();

    private AiModel model(String code) {
        AiModel m = AiModel.builder().provider(google).modelCode(code).displayName(code).enabled(true).build();
        m.setId(UUID.randomUUID());
        return m;
    }

    private static AiTaskRouting routing(AiTaskCode task, boolean enabled, AiModel primary, AiModel... fallbacks) {
        AiTaskRouting r = AiTaskRouting.builder().taskCode(task).primaryModel(primary).enabled(enabled).build();
        for (int i = 0; i < fallbacks.length; i++) {
            r.getFallbacks().add(AiTaskRoutingFallback.builder().routing(r).model(fallbacks[i]).position(i).build());
        }
        return r;
    }

    private static LlmAttemptPayload attempt(String model, String outcome, Integer http, Instant until) {
        return LlmAttemptPayload.builder().provider("google").model(model).outcome(outcome)
                .httpStatus(http).cooldownUntil(until).latencyMs(12L).build();
    }

    @Test
    void probesDistinctUsableRoutedModels_recordsHealthAndStoresResult() {
        AiModel dead = model("gemini-2.5-flash-lite");
        AiModel lite = model("gemini-3.1-flash-lite");
        AiModel flash = model("gemini-3.5-flash");
        AiModel disabled = model("gemini-x-disabled");
        AiModel offRouteOnly = model("gemini-off-route");

        AiTaskRoutingRepository routingRepo = mock(AiTaskRoutingRepository.class);
        when(routingRepo.findAllWithModels()).thenReturn(List.of(
                routing(AiTaskCode.CONTENT_GENERATION, true, dead, lite, disabled),
                routing(AiTaskCode.PLATFORM_FORMATTING, true, flash, dead),   // dead trùng → probe 1 lần
                routing(AiTaskCode.GOLDEN_HOURS, false, offRouteOnly)));      // route tắt → bỏ qua
        AiRuntimeConfigService runtime = mock(AiRuntimeConfigService.class);
        when(runtime.blockReason(any())).thenAnswer(inv ->
                inv.getArgument(0) == disabled ? AiModelBlockReason.MODEL_DISABLED : null);
        AiServiceClient client = mock(AiServiceClient.class);
        Instant until = Instant.now().plus(Duration.ofHours(6));
        when(client.probeModels(any())).thenReturn(ProbeModelsResultPayload.builder().results(List.of(
                attempt("gemini-2.5-flash-lite", "model_not_found", 404, until),
                attempt("gemini-3.1-flash-lite", "provider_overloaded", 503, Instant.now().plusSeconds(60)),
                attempt("gemini-3.5-flash", "ok", null, null))).build());
        AiModelHealthService health = mock(AiModelHealthService.class);
        AiModelRepository modelRepo = mock(AiModelRepository.class);

        List<AiModelProbeResponse> results = new AiModelProbeServiceImpl(routingRepo, modelRepo, runtime, health,
                client, new AiConfigMapperImpl()).probeRoutedModels();

        ArgumentCaptor<ProbeModelsPayload> sent = ArgumentCaptor.forClass(ProbeModelsPayload.class);
        verify(client).probeModels(sent.capture());
        assertEquals(List.of("gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"),
                sent.getValue().getSpecs().stream().map(LlmSpecPayload::getModel).toList());
        LlmSpecPayload spec = sent.getValue().getSpecs().get(0);
        assertEquals("google", spec.getProvider());
        assertEquals("k-google", spec.getApiKey());
        assertNull(spec.getMaxTokens(), "AI service tự ép max_tokens tối thiểu");

        verify(health).record(argThat(list -> list.size() == 3));
        verify(modelRepo).updateProbeResult(eq(dead.getId()), eq("model_not_found"), any());
        verify(modelRepo).updateProbeResult(eq(flash.getId()), eq("ok"), any());
        verify(modelRepo, never()).updateProbeResult(eq(disabled.getId()), any(), any());

        assertEquals(3, results.size());
        AiModelProbeResponse first = results.get(0);
        assertEquals(dead.getId(), first.getModelId());
        assertEquals("GOOGLE", first.getProviderCode());
        assertEquals("model_not_found", first.getOutcome());
        assertEquals(404, first.getHttpStatus());
    }

    @Test
    void noRoutedModels_doesNotCallAiService() {
        AiTaskRoutingRepository routingRepo = mock(AiTaskRoutingRepository.class);
        when(routingRepo.findAllWithModels()).thenReturn(List.of());
        AiServiceClient client = mock(AiServiceClient.class);

        List<AiModelProbeResponse> results = new AiModelProbeServiceImpl(routingRepo, mock(AiModelRepository.class),
                mock(AiRuntimeConfigService.class), mock(AiModelHealthService.class), client,
                new AiConfigMapperImpl()).probeRoutedModels();

        assertTrue(results.isEmpty());
        verify(client, never()).probeModels(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void modelNotFound_isUnavailableState_andNotifiesAdminsWithItsOwnVariant() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        NotificationService notifications = mock(NotificationService.class);
        AiModelHealthServiceImpl health = new AiModelHealthServiceImpl(redis, JsonMapper.builder().build(),
                mock(com.aima.mapper.AiConfigMapper.class), mock(AiProviderRepository.class), notifications);

        health.record(List.of(attempt("gemini-2.5-flash-lite", "model_not_found", 404,
                Instant.now().plus(Duration.ofHours(6)))));

        verify(ops).set(eq("ai:model-health:google:gemini-2.5-flash-lite"),
                argThat(json -> json.contains("\"state\":\"UNAVAILABLE\"") && json.contains("model_not_found")),
                argThat((Duration ttl) -> ttl.toMinutes() >= 359 && ttl.toMinutes() <= 360));
        ArgumentCaptor<NotificationDraft> draft = ArgumentCaptor.forClass(NotificationDraft.class);
        verify(notifications).sendToAdmins(draft.capture());
        assertEquals("UNAVAILABLE", draft.getValue().params().get("variant"));
        assertTrue(draft.getValue().message().contains("404"));
    }
}
