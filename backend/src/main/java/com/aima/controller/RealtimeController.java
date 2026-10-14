package com.aima.controller;

import com.aima.service.RealtimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Luồng realtime SSE — NGOẠI LỆ của quy tắc "mọi endpoint trả {@code ApiResponse}" (backend/CLAUDE.md rule #3):
 * body là {@code text/event-stream}. Lỗi TRƯỚC khi mở luồng (401, 503 quá tải) vẫn trả JSON {@code ApiResponse}
 * qua {@code GlobalExceptionHandler} — client gửi {@code Accept: text/event-stream, application/json}.
 */
@RestController
@RequestMapping("/realtime")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Realtime", description = "Server-Sent Events: notifications, job progress, post status, AI deltas.")
public class RealtimeController {

    RealtimeService realtimeService;

    @GetMapping("/stream")
    @Operation(summary = "Open the realtime event stream (SSE)",
            description = "Auth by the access_token cookie. Events: ready, notification.*, job.updated, post.updated, "
                    + "ai.delta, ai.reset, session.revoked, replaced, reconnect. Heartbeat comment every 20s; the server "
                    + "closes after 30 minutes or when the access token expires. Send Last-Event-ID to replay missed "
                    + "notifications.")
    public SseEmitter stream(@AuthenticationPrincipal UserDetails principal,
                             @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId,
                             HttpServletRequest request, HttpServletResponse response) {
        return realtimeService.open(principal.getUsername(), lastEventId, request, response);
    }
}
