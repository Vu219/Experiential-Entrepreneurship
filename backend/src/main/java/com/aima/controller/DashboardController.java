package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DashboardPerformanceResponse;
import com.aima.dto.response.DashboardSummaryResponse;
import com.aima.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * UI-02 — tab "Bảng điều khiển" của user. Một endpoint tổng hợp thay cho 7 lần gọi rời rạc;
 * riêng timeline "Hoạt động gần đây" tái dùng {@code GET /notifications} có sẵn (FR-75..FR-79).
 */
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Dashboard", description = "Aggregated data for the caller's dashboard tab (UI-02).")
public class DashboardController {

    DashboardService dashboardService;

    @GetMapping("/summary")
    @Operation(summary = "Aggregated dashboard data for the current user (UI-02)",
            description = "Returns the four stat cards (total / published / pending / rejected, each with a 7-day "
                    + "sparkline and 7-day delta), the reach + engagement series for the selected range, the content-type "
                    + "split, the top performing topics, connection status for all three in-scope platforms and the "
                    + "4-step setup progress (FR-86). days = 7 or 30; out-of-range values are clamped, not rejected.")
    public ApiResponse<DashboardSummaryResponse> getSummary(@AuthenticationPrincipal UserDetails principal,
                                                            @RequestParam(defaultValue = "7") int days) {
        return dashboardService.getSummary(principal.getUsername(), days);
    }

    @GetMapping("/performance")
    @Operation(summary = "Content performance chart for a custom date range (UI-02 filter)",
            description = "Daily views + engagement (reactions + comments + shares) between from and to, inclusive, zero-filled "
                    + "— the same numbers as the Analytics page. Defaults to the last 7 days. from earlier than the plan's "
                    + "analytics history is clamped; to after today becomes today; from after to → 2050, more than 366 days → 2051.")
    public ApiResponse<DashboardPerformanceResponse> getPerformance(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return dashboardService.getPerformance(principal.getUsername(), from, to);
    }
}
