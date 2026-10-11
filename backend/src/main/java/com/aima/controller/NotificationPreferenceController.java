package com.aima.controller;

import com.aima.dto.request.NotificationPreferenceRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.dto.response.UnsubscribeResponse;
import com.aima.service.NotificationPreferenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Email lỗi đăng bài (opt-in) — cài đặt của user + link huỷ nhận công khai trong email. */
@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Notification Preferences", description = "Opt-in email for publishing errors + signed unsubscribe link.")
public class NotificationPreferenceController {

    NotificationPreferenceService preferenceService;

    @GetMapping("/users/me/notification-preferences")
    @Operation(summary = "Caller's email preferences",
            description = "emailPublishErrors (default false), emailPromptStatus (NOT_ASKED|ACCEPTED|DECLINED), consentAt, "
                    + "emailAvailable = server sends publish-error emails (AIMA_PUBLISH_EMAIL_ENABLED).")
    public ApiResponse<NotificationPreferenceResponse> get(@AuthenticationPrincipal UserDetails principal) {
        return preferenceService.get(principal.getUsername());
    }

    @PutMapping("/users/me/notification-preferences")
    @Operation(summary = "Turn publish-error emails on/off (also answers the one-time prompt)")
    public ApiResponse<NotificationPreferenceResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                              @Valid @RequestBody NotificationPreferenceRequest request) {
        return preferenceService.update(principal.getUsername(), request);
    }

    @PostMapping("/notifications/unsubscribe")
    @Operation(summary = "Unsubscribe from publish-error emails (public, signed token)",
            description = "No login. Used by the confirmation page and by mail clients' one-click unsubscribe "
                    + "(RFC 8058 body List-Unsubscribe=One-Click is accepted and ignored).")
    public ApiResponse<UnsubscribeResponse> unsubscribe(@RequestParam String token) {
        return preferenceService.unsubscribe(token);
    }
}
