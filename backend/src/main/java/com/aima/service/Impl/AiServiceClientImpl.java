package com.aima.service.Impl;

import com.aima.config.AiServiceProperties;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.ai.RegeneratePartPayload;
import com.aima.dto.ai.RegeneratePartResultPayload;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.AiServiceClient;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AiServiceClientImpl implements AiServiceClient {

    WebClient webClient;
    AiServiceProperties properties;
    SystemLogService systemLogService;

    public AiServiceClientImpl(@Qualifier("aiServiceWebClient") WebClient webClient, AiServiceProperties properties,
                               SystemLogService systemLogService) {
        this.webClient = webClient;
        this.properties = properties;
        this.systemLogService = systemLogService;
    }

    @Override
    public GeneratedContentResult generateContent(GenerateContentPayload payload) {
        return post("/generate", payload, GeneratedContentResult.class);
    }

    @Override
    public ResearchResultPayload research(ResearchPayload payload) {
        return post("/research", payload, ResearchResultPayload.class);
    }

    @Override
    public FormatResultPayload format(FormatPayload payload) {
        return post("/format", payload, FormatResultPayload.class);
    }

    @Override
    public GoldenHourResultPayload goldenHours(GoldenHourPayload payload) {
        return post("/golden-hours", payload, GoldenHourResultPayload.class);
    }

    @Override
    public RegeneratePartResultPayload regeneratePart(RegeneratePartPayload payload) {
        return post("/regenerate-part", payload, RegeneratePartResultPayload.class);
    }

    private <T> T post(String uri, Object payload, Class<T> resultType) {
        try {
            return webClient.post()
                    .uri(uri)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(resultType)
                    .block(Duration.ofSeconds(properties.timeoutSeconds()));
        } catch (WebClientResponseException e) {
            throw aiFailure(uri, e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw aiFailure(uri, e.getMessage(), e);
        }
    }

    // NFR-11/FR-74: lỗi gọi AI service log console + lưu log hệ thống (trang Logs của admin) rồi mới ném.
    private AppException aiFailure(String uri, String detail, Exception cause) {
        log.warn("[AiService] POST {} lỗi: {}", uri, detail);
        systemLogService.error("ai.client", "POST " + uri + " lỗi: " + detail, cause);
        return new AppException(ErrorCode.AI_SERVICE_ERROR);
    }
}
