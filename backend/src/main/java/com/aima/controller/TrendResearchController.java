package com.aima.controller;

import com.aima.dto.request.TrendResearchRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;
import com.aima.service.TrendResearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    // NFR-04: trả về phiên PENDING ngay lập tức, phân tích chạy nền qua AI service.
    @PostMapping("/sessions")
    @Operation(summary = "Start a trend-research session (\"Research now\")",
            description = "Requires an active brand profile + ACTIVE strategy; rejects if a session is already running (FR-19).")
    public ApiResponse<TrendResearchSessionResponse> start(@AuthenticationPrincipal UserDetails principal,
                                                           @RequestBody(required = false) TrendResearchRequest request) {
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
}
