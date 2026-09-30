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

import com.aima.dto.request.ScheduleBatchRequest;
import com.aima.dto.response.ScheduleBatchResponse;
import com.aima.dto.response.SuggestedSlotResponse;
import org.springframework.web.bind.annotation.RequestHeader;
import java.time.Instant;
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
                                                    @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                    @Valid @RequestBody PostScheduleRequest request) {
        return postScheduleService.create(principal.getUsername(), request, idempotencyKey);
    }

    @PostMapping("/batch")
    @Operation(summary = "Create several schedules at once",
            description = "One row per platform/account; each row runs in its own transaction and is idempotent by its "
                    + "own idempotencyKey (same key + same payload replays the result, other payload → 2139). Rows fail "
                    + "independently (code/message per row); conflicts within the user's window are warnings only.")
    public ApiResponse<ScheduleBatchResponse> createBatch(@AuthenticationPrincipal UserDetails principal,
                                                          @Valid @RequestBody ScheduleBatchRequest request) {
        return postScheduleService.createBatch(principal.getUsername(), request);
    }

    @PostMapping("/{scheduleId}/publish-now")
    @Operation(summary = "Publish a schedule now",
            description = "SCHEDULED (or ON_HOLD with no remaining hold reason) → claimed with the same service as the "
                    + "dispatcher; the job is returned immediately and runs in the background. Requires approval first "
                    + "when the user's policy demands it (2138).")
    public ApiResponse<PostScheduleResponse> publishNow(@AuthenticationPrincipal UserDetails principal,
                                                        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                        @PathVariable UUID scheduleId) {
        return postScheduleService.publishNow(principal.getUsername(), scheduleId, idempotencyKey);
    }

    @GetMapping("/suggested-slots")
    @Operation(summary = "Free golden-hour slots for an account",
            description = "Golden-hour starts in the user's publishing timezone, skipping past times and times within the "
                    + "conflict window of existing schedules on that account. Nothing is reserved; count 1-20 (default 5).")
    public ApiResponse<List<SuggestedSlotResponse>> suggestSlots(@AuthenticationPrincipal UserDetails principal,
                                                                 @RequestParam UUID accountId,
                                                                 @RequestParam(required = false) Instant from,
                                                                 @RequestParam(required = false) Integer count) {
        return postScheduleService.suggestSlots(principal.getUsername(), accountId, from, count);
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
    @Operation(summary = "Move a schedule to a new time / account (FR-50)",
            description = "Only allowed while SCHEDULED or ON_HOLD (unpublished). Optional platformAccountId moves it to "
                    + "another account of the same platform. An ON_HOLD schedule resumes only when no hold reason remains.")
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
