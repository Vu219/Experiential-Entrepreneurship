package com.aima.controller;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GoldenHourResponse;
import com.aima.dto.response.PostScheduleResponse;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.service.PostScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Post Schedule", description = "Schedule formatted content for publishing (FR-47..FR-51, FR-48 golden hours).")
public class PostScheduleController {

    PostScheduleService postScheduleService;

    @PostMapping
    @Operation(summary = "Create a posting schedule (FR-47)",
            description = "Schedules one FORMATTED content version onto one ACTIVE connected account of the same "
                    + "platform (BR-05). Re-scheduling a CANCELLED schedule reuses it; an active schedule for the "
                    + "same version is rejected.")
    public ApiResponse<PostScheduleResponse> create(@AuthenticationPrincipal UserDetails principal,
                                                    @Valid @RequestBody PostScheduleRequest request) {
        return postScheduleService.create(principal.getUsername(), request);
    }

    @GetMapping
    @Operation(summary = "List schedules — the posting queue (FR-49)",
            description = "The caller's schedules ordered by scheduled time; optional status/platform filters "
                    + "(status=SCHEDULED is the upcoming queue).")
    public ApiResponse<List<PostScheduleResponse>> list(@AuthenticationPrincipal UserDetails principal,
                                                        @RequestParam(required = false) ScheduleStatus status,
                                                        @RequestParam(required = false) Platform platform) {
        return postScheduleService.list(principal.getUsername(), status, platform);
    }

    @GetMapping("/golden-hours")
    @Operation(summary = "Golden-hour suggestions for a platform (FR-48)",
            description = "Suggested posting time slots from the AI service — platform defaults until ≥10 analyzed "
                    + "posts exist, then data-driven.")
    public ApiResponse<GoldenHourResponse> suggestGoldenHours(@RequestParam Platform platform) {
        return postScheduleService.suggestGoldenHours(platform);
    }

    @GetMapping("/{scheduleId}")
    @Operation(summary = "Get one schedule",
            description = "Returns the schedule with its content version and target account; scoped to the caller.")
    public ApiResponse<PostScheduleResponse> get(@AuthenticationPrincipal UserDetails principal,
                                                 @PathVariable UUID scheduleId) {
        return postScheduleService.get(principal.getUsername(), scheduleId);
    }

    @PutMapping("/{scheduleId}")
    @Operation(summary = "Move a schedule to a new time (FR-50)",
            description = "Only allowed while SCHEDULED or ON_HOLD (unpublished).")
    public ApiResponse<PostScheduleResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID scheduleId,
                                                    @Valid @RequestBody PostScheduleUpdateRequest request) {
        return postScheduleService.update(principal.getUsername(), scheduleId, request);
    }

    @DeleteMapping("/{scheduleId}")
    @Operation(summary = "Cancel a schedule (FR-51)",
            description = "Unpublished schedules only (SCHEDULED/ON_HOLD/FAILED). The content version returns to "
                    + "FORMATTED so it can be re-scheduled.")
    public ApiResponse<PostScheduleResponse> cancel(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID scheduleId) {
        return postScheduleService.cancel(principal.getUsername(), scheduleId);
    }
}
