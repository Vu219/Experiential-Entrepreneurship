package com.aima.service.Impl;

import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicBoolean;
import reactor.core.publisher.Mono;
import org.springframework.http.MediaType;
import com.aima.service.AiStreamListener;
import com.aima.exception.AiStreamCancelledException;
import com.aima.dto.ai.GenerateStreamEventPayload;
import com.aima.config.AiServiceProperties;
import com.aima.dto.ai.AnalyzePayload;
import com.aima.dto.ai.AnalyzeResultPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.ai.OptimizePayload;
import com.aima.dto.ai.OptimizeResultPayload;
import com.aima.dto.ai.PolicyCheckPayload;
import com.aima.dto.ai.PolicyCheckResultPayload;
import com.aima.dto.ai.PolicyFixPayload;
import com.aima.dto.ai.PolicyFixResultPayload;
import com.aima.dto.ai.RegeneratePartPayload;
import com.aima.dto.ai.RegeneratePartResultPayload;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.ai.TestConnectionPayload;
import com.aima.dto.ai.TestConnectionResultPayload;
import com.aima.dto.ai.ListModelsPayload;
import com.aima.dto.ai.ListModelsResultPayload;
import com.aima.dto.ai.LlmRoutedPayload;
import com.aima.dto.ai.AiErrorResponsePayload;
import com.aima.dto.ai.TokenAccountedPayload;
import com.aima.enums.AiTaskCode;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiServiceClient;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import tools.jackson.databind.ObjectMapper;

import java.time.Duration;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AiServiceClientImpl implements AiServiceClient {

    WebClient webClient;
    AiServiceProperties properties;
    SystemLogService systemLogService;
    AiRuntimeConfigService runtimeConfigService;
    AiModelHealthService modelHealthService;
    ObjectMapper objectMapper;

    public AiServiceClientImpl(@Qualifier("aiServiceWebClient") WebClient webClient, AiServiceProperties properties,
                               SystemLogService systemLogService, AiRuntimeConfigService runtimeConfigService,
                               AiModelHealthService modelHealthService, ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.systemLogService = systemLogService;
        this.runtimeConfigService = runtimeConfigService;
        this.modelHealthService = modelHealthService;
        this.objectMapper = objectMapper;
    }

    @Override
    public GeneratedContentResult generateContent(GenerateContentPayload payload) {
        applyRouting(payload, AiTaskCode.CONTENT_GENERATION);
        return post("/generate", payload, GeneratedContentResult.class);
    }

    @Override
    public ResearchResultPayload research(ResearchPayload payload) {
        applyRouting(payload, AiTaskCode.TREND_RESEARCH);
        return post("/research", payload, ResearchResultPayload.class, properties.effectiveResearchTimeoutSeconds());
    }

    @Override
    public FormatResultPayload format(FormatPayload payload) {
        applyRouting(payload, AiTaskCode.PLATFORM_FORMATTING);
        return post("/format", payload, FormatResultPayload.class);
    }

    @Override
    public GoldenHourResultPayload goldenHours(GoldenHourPayload payload) {
        applyRouting(payload, AiTaskCode.GOLDEN_HOURS);
        return post("/golden-hours", payload, GoldenHourResultPayload.class);
    }

    @Override
    public RegeneratePartResultPayload regeneratePart(RegeneratePartPayload payload) {
        applyRouting(payload, AiTaskCode.CONTENT_REGENERATION);
        return post("/regenerate-part", payload, RegeneratePartResultPayload.class);
    }

    @Override
    public AnalyzeResultPayload analyze(AnalyzePayload payload) {
        applyRouting(payload, AiTaskCode.STRATEGY_OPTIMIZATION);
        return post("/analyze", payload, AnalyzeResultPayload.class);
    }

    @Override
    public OptimizeResultPayload optimize(OptimizePayload payload) {
        applyRouting(payload, AiTaskCode.STRATEGY_OPTIMIZATION);
        return post("/optimize", payload, OptimizeResultPayload.class);
    }

    @Override
    public PolicyFixResultPayload policyFix(PolicyFixPayload payload) {
        applyRouting(payload, AiTaskCode.POLICY_FIX);
        return post("/policy-fix", payload, PolicyFixResultPayload.class);
    }

    @Override
    public PolicyCheckResultPayload policyCheck(PolicyCheckPayload payload) {
        applyRouting(payload, AiTaskCode.POLICY_CHECK);
        return post("/policy-check", payload, PolicyCheckResultPayload.class);
    }

    @Override
    public GeneratedContentResult generateContentStream(GenerateContentPayload payload, AiStreamListener listener,
                                                        Mono<Void> cancel) {
        applyRouting(payload, AiTaskCode.CONTENT_GENERATION);
        String uri = "/generate/stream";
        AtomicReference<GeneratedContentResult> done = new AtomicReference<>();
        AtomicReference<GenerateStreamEventPayload> failure = new AtomicReference<>();
        AtomicBoolean cancelled = new AtomicBoolean();
        AtomicLong inputTokens = new AtomicLong();
        AtomicLong receivedChars = new AtomicLong();
        try {
            webClient.post()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_NDJSON)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToFlux(String.class) // StringDecoder tách theo dòng → một sự kiện NDJSON mỗi phần tử
                    .takeUntilOther(cancel.doOnTerminate(() -> cancelled.set(true)))
                    .doOnNext(line -> onStreamLine(line, listener, done, failure, inputTokens, receivedChars))
                    .blockLast(Duration.ofSeconds(properties.timeoutSeconds()));
        } catch (WebClientResponseException e) {
            ErrorCode code = recordFailedChain(e.getResponseBodyAsString());
            throw aiFailure(uri, e.getStatusCode() + ": " + e.getResponseBodyAsString(), e, code);
        } catch (Exception e) {
            ErrorCode code = isBlockTimeout(e) ? ErrorCode.AI_TIMEOUT : ErrorCode.AI_SERVICE_ERROR;
            throw aiFailure(uri, e.getMessage(), e, code);
        }
        if (done.get() != null) {
            modelHealthService.record(done.get().getLlmAttempts());
            return done.get();
        }
        if (failure.get() != null) {
            GenerateStreamEventPayload error = failure.get();
            modelHealthService.record(error.getAttempts());
            throw aiFailure(uri, "stream error " + error.getErrorCode() + ": " + error.getMessage(), null,
                    chainErrorCode(error.getErrorCode()));
        }
        if (cancelled.get()) {
            long output = estimateTokens(receivedChars.get());
            GeneratedContentResult partial = GeneratedContentResult.builder()
                    .inputTokens(inputTokens.get()).outputTokens(output).tokensUsed(inputTokens.get() + output)
                    .cachedTokens(0L).build();
            throw new AiStreamCancelledException(partial);
        }
        throw aiFailure(uri, "stream ended without a result", null, ErrorCode.AI_SERVICE_ERROR);
    }

    /** Ước lượng token output khi bị huỷ (không có usage thật của phần đã sinh): ~3 ký tự / token cho chữ Việt + JSON. */
    static long estimateTokens(long chars) {
        return chars <= 0 ? 0 : (chars + 2) / 3;
    }

    private void onStreamLine(String line, AiStreamListener listener, AtomicReference<GeneratedContentResult> done,
                              AtomicReference<GenerateStreamEventPayload> failure, AtomicLong inputTokens,
                              AtomicLong receivedChars) {
        if (line == null || line.isBlank()) return;
        GenerateStreamEventPayload event;
        try {
            event = objectMapper.readValue(line, GenerateStreamEventPayload.class);
        } catch (Exception e) {
            log.warn("[AiService] Bỏ qua dòng stream không đọc được: {}", e.getClass().getSimpleName());
            return;
        }
        try {
            switch (String.valueOf(event.getType())) {
                case "start" -> {
                    if (event.getInputTokens() != null) inputTokens.set(event.getInputTokens());
                    listener.onStart(event.getProvider(), event.getModel(), event.getInputTokens());
                }
                case "delta" -> {
                    if (event.getAppend() == null) return;
                    receivedChars.addAndGet(event.getAppend().length());
                    listener.onDelta(event.getPath(), event.getAppend(), Boolean.TRUE.equals(event.getReplace()));
                }
                case "reset" -> listener.onReset(event.getReason());
                case "done" -> done.set(event.getResult());
                case "error" -> failure.set(event);
                default -> { /* sự kiện lạ của AI service bản mới hơn — bỏ qua */ }
            }
        } catch (Exception e) {
            // listener không được làm hỏng luồng: xem trước chỉ là gợi ý, kết quả cuối vẫn lưu từ "done".
            log.warn("[AiService] Listener stream lỗi: {}", e.toString());
        }
    }

    /**
     * Gắn llm_config theo bảng định tuyến (AI_CONFIG_FROM_DB) ngay trước khi gửi —
     * một điểm duy nhất, worker không phải biết. null = AI service dùng env (rollback).
     * Model đang nghỉ (circuit breaker, {@link AiModelHealthService}) bị bỏ khỏi chuỗi.
     */
    private void applyRouting(LlmRoutedPayload payload, AiTaskCode taskCode) {
        if (payload.getLlmConfig() == null) {
            payload.setLlmConfig(modelHealthService.filterAvailable(runtimeConfigService.getLlmConfig(taskCode)));
        }
    }

    // Payload chứa API key plaintext — post() không log request body nên key không lọt vào log/APM.
    @Override
    public TestConnectionResultPayload testConnection(TestConnectionPayload payload) {
        return post("/test-connection", payload, TestConnectionResultPayload.class);
    }

    // Payload chứa API key plaintext — cùng ràng buộc không-log như testConnection.
    @Override
    public ListModelsResultPayload listModels(ListModelsPayload payload) {
        return post("/list-models", payload, ListModelsResultPayload.class);
    }

    private <T> T post(String uri, Object payload, Class<T> resultType) {
        return post(uri, payload, resultType, properties.timeoutSeconds());
    }

    private <T> T post(String uri, Object payload, Class<T> resultType, long timeoutSeconds) {
        try {
            T result = webClient.post()
                    .uri(uri)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(resultType)
                    .block(Duration.ofSeconds(timeoutSeconds));
            if (result instanceof TokenAccountedPayload accounted) {
                modelHealthService.record(accounted.getLlmAttempts());
            }
            return result;
        } catch (WebClientResponseException e) {
            ErrorCode code = recordFailedChain(e.getResponseBodyAsString());
            throw aiFailure(uri, e.getStatusCode() + ": " + e.getResponseBodyAsString(), e, code);
        } catch (Exception e) {
            // block(timeout) hết giờ → IllegalStateException bọc TimeoutException: AI chưa trả kịp.
            ErrorCode code = isBlockTimeout(e) ? ErrorCode.AI_TIMEOUT : ErrorCode.AI_SERVICE_ERROR;
            throw aiFailure(uri, e.getMessage(), e, code);
        }
    }

    /**
     * 502 "cả chuỗi thất bại" mang vết từng model → cập nhật circuit breaker, và {@code error_code}
     * → ErrorCode cùng tên (worker lưu vào job, FE ánh xạ câu thân thiện). Body khác (detail là
     * chuỗi — lỗi cấu hình/validate) hoặc mã lạ → AI_SERVICE_ERROR.
     */
    private ErrorCode recordFailedChain(String body) {
        try {
            AiErrorResponsePayload error = objectMapper.readValue(body, AiErrorResponsePayload.class);
            if (error.getDetail() != null) {
                modelHealthService.record(error.getDetail().getAttempts());
                return chainErrorCode(error.getDetail().getErrorCode());
            }
        } catch (Exception e) {
            log.debug("[AiService] Body lỗi không phải vết chuỗi fallback: {}", e.getMessage());
        }
        return ErrorCode.AI_SERVICE_ERROR;
    }

    /** error_code của AI service (ai/src/llm.py) → ErrorCode backend; null/lạ → AI_SERVICE_ERROR. */
    static ErrorCode chainErrorCode(String aiErrorCode) {
        if (aiErrorCode == null) {
            return ErrorCode.AI_SERVICE_ERROR;
        }
        return switch (aiErrorCode) {
            case "AI_PROVIDER_OVERLOADED" -> ErrorCode.AI_PROVIDER_OVERLOADED;
            case "AI_QUOTA_EXHAUSTED" -> ErrorCode.AI_QUOTA_EXHAUSTED;
            case "AI_TIMEOUT" -> ErrorCode.AI_TIMEOUT;
            case "AI_BAD_REQUEST" -> ErrorCode.AI_BAD_REQUEST;
            case "AI_UNAVAILABLE" -> ErrorCode.AI_UNAVAILABLE;
            default -> ErrorCode.AI_SERVICE_ERROR;
        };
    }

    private static boolean isBlockTimeout(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.util.concurrent.TimeoutException
                    || (t instanceof IllegalStateException && t.getMessage() != null
                        && t.getMessage().startsWith("Timeout on blocking read"))) {
                return true;
            }
        }
        return false;
    }

    // NFR-11/FR-74: lỗi gọi AI service log console + lưu log hệ thống (trang Logs của admin) rồi mới ném.
    private AppException aiFailure(String uri, String detail, Exception cause, ErrorCode code) {
        log.warn("[AiService] POST {} lỗi ({}): {}", uri, code, detail);
        systemLogService.error("ai.client", "POST " + uri + " lỗi: " + detail, cause);
        return new AppException(code);
    }
}
