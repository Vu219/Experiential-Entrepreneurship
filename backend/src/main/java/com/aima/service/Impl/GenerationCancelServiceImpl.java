package com.aima.service.Impl;

import com.aima.service.GenerationCancelService;
import com.aima.service.RealtimeControlHandler;
import com.aima.service.RealtimeEventPublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class GenerationCancelServiceImpl implements GenerationCancelService, RealtimeControlHandler {

    public static final String COMMAND = "job.cancel";

    private final Map<UUID, Sinks.Empty<Void>> running = new ConcurrentHashMap<>();
    private final RealtimeEventPublisher publisher;

    // @Lazy: publisher → listener → danh sách RealtimeControlHandler (gồm chính bean này) — tránh vòng phụ thuộc lúc khởi tạo.
    public GenerationCancelServiceImpl(@Lazy RealtimeEventPublisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public Mono<Void> register(UUID jobId) {
        Sinks.Empty<Void> sink = Sinks.empty();
        running.put(jobId, sink);
        return sink.asMono();
    }

    @Override
    public void unregister(UUID jobId) {
        running.remove(jobId);
    }

    @Override
    public void requestCancel(UUID jobId) {
        publisher.control(COMMAND, Map.of("jobId", jobId.toString()));
    }

    @Override
    public String command() {
        return COMMAND;
    }

    @Override
    public void handle(JsonNode data) {
        if (data == null || data.get("jobId") == null) return;
        UUID jobId;
        try {
            jobId = UUID.fromString(data.get("jobId").asText());
        } catch (IllegalArgumentException e) {
            return;
        }
        Sinks.Empty<Void> sink = running.remove(jobId);
        if (sink != null) {
            log.info("[ContentGeneration] Huỷ luồng AI của job {} theo yêu cầu user", jobId);
            sink.tryEmitEmpty();
        }
    }
}
