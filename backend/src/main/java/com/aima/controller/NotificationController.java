package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationResponse;
import com.aima.dto.response.PageResponse;
import com.aima.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Notification", description = "In-app notifications: published/failed posts, review needed, reconnection needed (FR-75..FR-79).")
public class NotificationController {

    NotificationService notificationService;

    @GetMapping
    @Operation(summary = "List notifications (newest first)",
            description = "Paged; unreadOnly=true returns only unread ones.")
    public ApiResponse<PageResponse<NotificationResponse>> list(@AuthenticationPrincipal UserDetails principal,
                                                                @RequestParam(defaultValue = "false") boolean unreadOnly,
                                                                @RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "10") int size) {
        return notificationService.list(principal.getUsername(), unreadOnly, page, size);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Number of unread notifications", description = "For the bell badge in the header.")
    public ApiResponse<Long> unreadCount(@AuthenticationPrincipal UserDetails principal) {
        return notificationService.unreadCount(principal.getUsername());
    }

    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "Mark one notification as read")
    public ApiResponse<NotificationResponse> markRead(@AuthenticationPrincipal UserDetails principal,
                                                      @PathVariable UUID notificationId) {
        return notificationService.markRead(principal.getUsername(), notificationId);
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read", description = "Returns how many were updated.")
    public ApiResponse<Long> markAllRead(@AuthenticationPrincipal UserDetails principal) {
        return notificationService.markAllRead(principal.getUsername());
    }
}
