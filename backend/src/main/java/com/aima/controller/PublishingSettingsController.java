package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.request.PublishingSettingsRequest;
import com.aima.dto.response.PublishingSettingsResponse;
import com.aima.service.PublishingSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users/me/publishing-settings")
@RequiredArgsConstructor
public class PublishingSettingsController {
    private final PublishingSettingsService service;

    @GetMapping
    @Operation(summary = "Get the authenticated user's publishing settings (timezone + policy)")
    public ApiResponse<PublishingSettingsResponse> get(@AuthenticationPrincipal UserDetails principal) {
        return service.get(principal.getUsername());
    }

    @PutMapping
    @Operation(summary = "Update publishing settings",
            description = "Timezone (IANA), requireApproval (unapproved schedules are held PENDING_REVIEW; toggling "
                    + "re-applies to every unpublished schedule), conflictWindowMinutes (0-1440), brand-voice blocking "
                    + "with a 0-100 threshold (required when enabled).")
    public ApiResponse<PublishingSettingsResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                          @Valid @RequestBody PublishingSettingsRequest request) {
        return service.update(principal.getUsername(), request);
    }
}
