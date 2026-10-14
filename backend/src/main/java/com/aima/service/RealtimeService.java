package com.aima.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Mở luồng SSE của user hiện tại ({@code GET /realtime/stream}). */
public interface RealtimeService {

    /**
     * Đăng ký kết nối, phát bù thông báo sau {@code lastEventId} (tối đa {@code replayLimit}) rồi gửi {@code ready}.
     * Chỉ chạm DB trong transaction ngắn, trả connection TRƯỚC khi trả emitter (pool Hikari nhỏ).
     */
    SseEmitter open(String email, String lastEventId, HttpServletRequest request, HttpServletResponse response);
}
