package com.aima.controller;

import com.aima.dto.request.IdeaSavedRequest;
import com.aima.dto.request.TrendDeleteRequest;
import com.aima.dto.request.TrendResearchScheduleRequest;
import com.aima.dto.request.TrendResearchRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.TrendResearchScheduleResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.service.TrendResearchService;
import com.aima.service.TrendResearchSettingsService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/trend-research")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Trend Research", description = "AI trend research sessions (FR-19..FR-23, NFR-04 async).")
public class TrendResearchController {

    TrendResearchService trendResearchService;
    TrendResearchSettingsService trendResearchSettingsService;

    // NFR-04: trả về phiên PENDING ngay lập tức, phân tích chạy nền qua AI service.
    @PostMapping("/sessions")
    @Operation(summary = "Start a trend-research session (\"Research now\")",
            description = "Requires an active brand profile + ACTIVE strategy; rejects if a session is already running (FR-19).")
    public ApiResponse<TrendResearchSessionResponse> start(@AuthenticationPrincipal UserDetails principal,
                                                           @Valid @RequestBody(required = false) TrendResearchRequest request) {
        return trendResearchService.startResearch(principal.getUsername(), request);
    }

    @GetMapping("/sessions/{sessionId}")
    @Operation(summary = "Get a research session with its trends and ideas",
            description = "Polled by the frontend until status is COMPLETED or FAILED.")
    public ApiResponse<TrendResearchSessionResponse> getSession(@AuthenticationPrincipal UserDetails principal,
                                                                @PathVariable UUID sessionId) {
        return trendResearchService.getSession(principal.getUsername(), sessionId);
    }

    @GetMapping("/sessions")
    @Operation(summary = "List the caller's research sessions (history)",
            description = "Newest first; counts only — fetch a session by id for full trends/ideas (FR-23).")
    public ApiResponse<List<TrendResearchSessionSummaryResponse>> listSessions(@AuthenticationPrincipal UserDetails principal) {
        return trendResearchService.listSessions(principal.getUsername());
    }

    @DeleteMapping("/trends")
    @Operation(summary = "Soft-delete unwanted trends (multi-select)",
            description = "Deletes the caller's trends (and their content ideas) by id; returns the deleted count.")
    public ApiResponse<Integer> deleteTrends(@AuthenticationPrincipal UserDetails principal,
                                             @Valid @RequestBody TrendDeleteRequest request) {
        return trendResearchService.deleteTrends(principal.getUsername(), request);
    }

    @GetMapping("/schedule")
    @Operation(summary = "Get the caller's automatic trend-research schedule",
            description = "result null = not configured (default: daily 02:00 on the active brand profile).")
    public ApiResponse<TrendResearchScheduleResponse> getSchedule(@AuthenticationPrincipal UserDetails principal) {
        return trendResearchSettingsService.getSchedule(principal.getUsername());
    }

    @PutMapping("/schedule")
    @Operation(summary = "Create or replace the automatic trend-research schedule",
            description = "Runs at the chosen hour (minutes ignored) daily or on chosen weekdays (0 = Monday). "
                    + "Enabling requires a plan that includes automatic research (PLAN_FEATURE_NOT_INCLUDED 2206).")
    public ApiResponse<TrendResearchScheduleResponse> saveSchedule(@AuthenticationPrincipal UserDetails principal,
                                                                   @Valid @RequestBody TrendResearchScheduleRequest request) {
        return trendResearchSettingsService.saveSchedule(principal.getUsername(), request);
    }

    @PutMapping("/ideas/{ideaId}/saved")
    @Operation(summary = "Save or unsave a content idea", description = "Persists \"Lưu ý tưởng\" on the server (was localStorage).")
    public ApiResponse<ContentIdeaResponse> setIdeaSaved(@AuthenticationPrincipal UserDetails principal,
                                                         @PathVariable UUID ideaId,
                                                         @Valid @RequestBody IdeaSavedRequest request) {
        return trendResearchSettingsService.setIdeaSaved(principal.getUsername(), ideaId, request);
    }
}
