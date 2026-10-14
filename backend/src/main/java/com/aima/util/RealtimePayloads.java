package com.aima.util;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;

/** Khung payload chung của mọi sự kiện SSE: payload object + {@code v} (phiên bản) + {@code ts} (thời điểm phát, UTC). */
public final class RealtimePayloads {

    public static final int VERSION = 1;

    private RealtimePayloads() {
    }

    public static JsonNode envelope(ObjectMapper objectMapper, Object payload) {
        ObjectNode node = payload == null ? objectMapper.createObjectNode()
                : (ObjectNode) objectMapper.valueToTree(payload);
        node.put("v", VERSION);
        node.put("ts", Instant.now().toString());
        return node;
    }
}
