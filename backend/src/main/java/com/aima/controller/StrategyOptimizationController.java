package com.aima.controller;

import com.aima.dto.request.AdjustmentDecisionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.StrategyAdjustmentResponse;
import com.aima.dto.response.StrategyOptimizationJobResponse;
import com.aima.enums.AppliedStatus;
import com.aima.service.StrategyOptimizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/content-strategies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Strategy Optimization",
        description = "Data-driven strategy optimization (FR-65..FR-68): async AI run proposing adjustments the user accepts/rejects.")
public class StrategyOptimizationController {

    StrategyOptimizationService strategyOptimizationService;

    @PostMapping("/{strategyId}/optimize")
    @Operation(summary = "Start an optimization run (NFR-04 async)",
            description = "Requires at least one published post with collected analytics for the strategy's brand.")
    public ApiResponse<StrategyOptimizationJobResponse> start(@AuthenticationPrincipal UserDetails principal,
                                                              @PathVariable UUID strategyId) {
        return strategyOptimizationService.start(principal.getUsername(), strategyId);
    }

    @GetMapping("/optimize-jobs/{jobId}")
    @Operation(summary = "Get an optimization job's status",
            description = "Polled by the frontend until SUCCESS/FAILED; pending proposals ride along on SUCCESS.")
    public ApiResponse<StrategyOptimizationJobResponse> getJob(@AuthenticationPrincipal UserDetails principal,
                                                               @PathVariable UUID jobId) {
        return strategyOptimizationService.getJob(principal.getUsername(), jobId);
    }

    @GetMapping("/{strategyId}/adjustments")
    @Operation(summary = "Adjustment history of a strategy (FR-67)",
            description = "All proposals ever made for this strategy, newest first; filter by status if given.")
    public ApiResponse<List<StrategyAdjustmentResponse>> listAdjustments(@AuthenticationPrincipal UserDetails principal,
                                                                         @PathVariable UUID strategyId,
                                                                         @RequestParam(required = false) AppliedStatus status) {
        return strategyOptimizationService.listAdjustments(principal.getUsername(), strategyId, status);
    }

    @PatchMapping("/adjustments/{adjustmentId}")
    @Operation(summary = "Accept or reject a proposal (FR-68)",
            description = "Only PENDING proposals can be decided; APPLIED means the user agrees and updates the strategy accordingly.")
    public ApiResponse<StrategyAdjustmentResponse> decide(@AuthenticationPrincipal UserDetails principal,
                                                          @PathVariable UUID adjustmentId,
                                                          @Valid @RequestBody AdjustmentDecisionRequest request) {
        return strategyOptimizationService.decide(principal.getUsername(), adjustmentId, request);
    }
}
