package com.aima.service.Impl;

import com.aima.dto.realtime.RealtimeMessage;
import com.aima.service.RealtimeConnectionRegistry;
import com.aima.service.RealtimeControlHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nhận message từ kênh Redis (hoặc trực tiếp từ publisher khi {@code aima.realtime.bus=local}) và giao cho registry
 * local / handler control. Chạy trên luồng listener của Redis → chỉ xếp hàng, không ghi socket tại đây.
 */
@Component
@Slf4j
public class RealtimeMessageListener implements MessageListener {

    private final RealtimeConnectionRegistry registry;
    private final ObjectMapper objectMapper;
    private final Map<String, RealtimeControlHandler> controlHandlers;

    public RealtimeMessageListener(RealtimeConnectionRegistry registry, ObjectMapper objectMapper,
                                   List<RealtimeControlHandler> controlHandlers) {
        this.registry = registry;
        this.objectMapper = objectMapper;
        this.controlHandlers = controlHandlers.stream()
                .collect(Collectors.toMap(RealtimeControlHandler::command, Function.identity()));
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        handle(new String(message.getBody(), StandardCharsets.UTF_8));
    }

    public void handle(String json) {
        try {
            RealtimeMessage message = objectMapper.readValue(json, RealtimeMessage.class);
            if (Boolean.TRUE.equals(message.getControl())) {
                RealtimeControlHandler handler = controlHandlers.get(message.getEvent());
                if (handler != null) handler.handle(message.getData());
                return;
            }
            registry.deliver(message);
        } catch (Exception e) {
            log.warn("[Realtime] Bỏ qua message lỗi: {}", e.toString());
        }
    }
}
