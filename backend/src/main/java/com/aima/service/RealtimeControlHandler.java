package com.aima.service;

import tools.jackson.databind.JsonNode;

/** Xử lý một lệnh control nhận từ bus realtime (mọi instance nhận; handler tự bỏ qua nếu không liên quan). */
public interface RealtimeControlHandler {

    String command();

    void handle(JsonNode data);
}
