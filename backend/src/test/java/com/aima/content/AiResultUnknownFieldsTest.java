package com.aima.content;

import com.aima.dto.ai.GeneratedContentResult;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * AI service thêm field mới vào response (vd {@code llm_attempts} — vết chuỗi fallback) thì
 * WebClient của backend (codec mặc định, như aiServiceWebClient) vẫn phải decode được.
 */
class AiResultUnknownFieldsTest {

    @Test
    void generateResultWithLlmAttempts_decodes() {
        String json = "{\"caption\":\"xin chao\",\"hashtags\":[],\"tokens_used\":42,"
                + "\"llm_attempts\":[{\"provider\":\"google\",\"model\":\"gemini-3.5-flash\","
                + "\"outcome\":\"daily_quota_exhausted\",\"cooldown_until\":\"2026-09-30T07:00:00Z\"}]}";
        WebClient client = WebClient.builder()
                .exchangeFunction(req -> Mono.just(ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(json).build()))
                .build();

        GeneratedContentResult result = client.post().uri("http://ai/generate").retrieve()
                .bodyToMono(GeneratedContentResult.class).block();

        assertEquals("xin chao", result.getCaption());
        assertEquals(42L, result.getTokensUsed());
    }
}
