package com.aima.service.Impl;

import com.aima.config.AiServiceProperties;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.AiServiceClient;
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

    public AiServiceClientImpl(@Qualifier("aiServiceWebClient") WebClient webClient, AiServiceProperties properties) {
        this.webClient = webClient;
        this.properties = properties;
    }

    @Override
    public GeneratedContentResult generateContent(GenerateContentPayload payload) {
        try {
            return webClient.post()
                    .uri("/generate")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(GeneratedContentResult.class)
                    .block(Duration.ofSeconds(properties.timeoutSeconds()));
        } catch (WebClientResponseException e) {
            log.warn("[AiService] POST /generate lỗi {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        } catch (Exception e) {
            log.warn("[AiService] POST /generate thất bại: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        }
    }

    @Override
    public ResearchResultPayload research(ResearchPayload payload) {
        try {
            return webClient.post()
                    .uri("/research")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(ResearchResultPayload.class)
                    .block(Duration.ofSeconds(properties.timeoutSeconds()));
        } catch (WebClientResponseException e) {
            log.warn("[AiService] POST /research lỗi {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        } catch (Exception e) {
            log.warn("[AiService] POST /research thất bại: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_SERVICE_ERROR);
        }
    }
}
