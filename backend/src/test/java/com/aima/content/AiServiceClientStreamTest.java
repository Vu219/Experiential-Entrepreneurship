package com.aima.content;

import com.aima.config.AiServiceProperties;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.exception.AiStreamCancelledException;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.AiModelHealthService;
import com.aima.service.AiRuntimeConfigService;
import com.aima.service.AiStreamListener;
import com.aima.service.Impl.AiServiceClientImpl;
import com.aima.service.SystemLogService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bước 5: client NDJSON {@code /generate/stream} — delta tới listener, kết quả "done", lỗi chuỗi model, huỷ giữa chừng. */
class AiServiceClientStreamTest {

    static final String RESULT = "{\"script\":{\"hook\":{\"content\":\"Hook\",\"scene_suggestion\":\"S\",\"timing\":\"0-3s\"},"
            + "\"steps\":[{\"index\":1,\"content\":\"B1\",\"scene_suggestion\":\"S1\"}],"
            + "\"cta\":{\"content\":\"CTA\",\"scene_suggestion\":\"S\",\"timing\":\"25-30s\"}},"
            + "\"caption\":\"Xin chào\",\"hashtags\":[\"#a\"],\"cta\":\"Mua\",\"media_prompt\":\"m\",\"image_prompt\":\"\","
            + "\"brand_voice_check\":{\"aligned\":true,\"score\":90,\"notes\":\"ok\"},"
            + "\"tokens_used\":420,\"input_tokens\":120,\"output_tokens\":300,\"cached_tokens\":0,"
            + "\"llm_attempts\":[{\"provider\":\"google\",\"model\":\"m1\",\"outcome\":\"ok\"}]}";

    private MockWebServer server;
    private AiServiceClientImpl client;
    private final AiModelHealthService health = mock(AiModelHealthService.class);

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        AiRuntimeConfigService runtime = mock(AiRuntimeConfigService.class);
        when(health.filterAvailable(any())).thenAnswer(inv -> inv.getArgument(0));
        client = new AiServiceClientImpl(WebClient.builder().baseUrl(server.url("/").toString()).build(),
                new AiServiceProperties(server.url("/").toString(), 10, 0, null), mock(SystemLogService.class),
                runtime, health, JsonMapper.builder().build());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static class Recorder implements AiStreamListener {
        final List<String> events = new ArrayList<>();

        @Override
        public void onStart(String provider, String model, Long inputTokens) {
            events.add("start:" + model + ":" + inputTokens);
        }

        @Override
        public void onDelta(String path, String append, boolean replace) {
            events.add("delta:" + path + ":" + append + (replace ? ":replace" : ""));
        }

        @Override
        public void onReset(String reason) {
            events.add("reset:" + reason);
        }
    }

    private static MockResponse ndjson(String body) {
        return new MockResponse().setHeader("Content-Type", "application/x-ndjson").setBody(body);
    }

    @Test
    void streamsDeltasToListener_andReturnsDoneResult() throws Exception {
        server.enqueue(ndjson("""
                {"type":"start","provider":"google","model":"m1","input_tokens":120}
                {"type":"delta","path":"caption","append":"Xin "}
                {"type":"reset","reason":"fallback"}
                {"type":"delta","path":"caption","append":"Xin chào","replace":true}
                {"type":"done","result":%s}
                """.formatted(RESULT)));
        Recorder recorder = new Recorder();

        GeneratedContentResult result = client.generateContentStream(new GenerateContentPayload(), recorder, Mono.never());

        assertEquals("Xin chào", result.getCaption());
        assertEquals(420L, result.getTokensUsed());
        assertEquals(List.of("start:m1:120", "delta:caption:Xin ", "reset:fallback", "delta:caption:Xin chào:replace"),
                recorder.events);
        assertEquals("/generate/stream", server.takeRequest(1, TimeUnit.SECONDS).getPath());
    }

    @Test
    void errorEvent_mapsChainCodeLikeTheNonStreamPath() {
        server.enqueue(ndjson("""
                {"type":"start","provider":"google","model":"m1"}
                {"type":"error","error_code":"AI_QUOTA_EXHAUSTED","message":"x","attempts":[]}
                """));
        AppException e = assertThrows(AppException.class,
                () -> client.generateContentStream(new GenerateContentPayload(), new Recorder(), Mono.never()));
        assertEquals(ErrorCode.AI_QUOTA_EXHAUSTED, e.getErrorCode());
    }

    @Test
    void cancelMidStream_closesAndReportsPartialUsage() {
        // Body chảy chậm (8 byte / 100ms): huỷ sau delta đầu tiên, không chờ "done".
        server.enqueue(ndjson("""
                {"type":"start","provider":"google","model":"m1","input_tokens":150}
                {"type":"delta","path":"caption","append":"123456789"}
                {"type":"delta","path":"caption","append":"more text that never arrives"}
                {"type":"done","result":%s}
                """.formatted(RESULT)).throttleBody(8, 100, TimeUnit.MILLISECONDS));
        Sinks.Empty<Void> cancel = Sinks.empty();
        AiStreamListener listener = new Recorder() {
            @Override
            public void onDelta(String path, String append, boolean replace) {
                super.onDelta(path, append, replace);
                cancel.tryEmitEmpty(); // user bấm Dừng ngay khi thấy chữ đầu tiên
            }
        };

        AiStreamCancelledException e = assertThrows(AiStreamCancelledException.class,
                () -> client.generateContentStream(new GenerateContentPayload(), listener, cancel.asMono()));

        assertEquals(150L, e.getPartialUsage().getInputTokens(), "input thật từ sự kiện start");
        assertEquals(3L, e.getPartialUsage().getOutputTokens(), "9 ký tự đã nhận ≈ 3 token");
        assertEquals(153L, e.getPartialUsage().getTokensUsed());
    }
}
