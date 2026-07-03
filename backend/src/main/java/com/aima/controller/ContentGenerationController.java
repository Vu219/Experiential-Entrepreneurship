package com.aima.controller;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentGenerationJobResponse;
import com.aima.service.ContentGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

import java.util.UUID;

@RestController
@RequestMapping("/content-items")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Content Generation", description = "AI content generation jobs (FR-24..FR-30, NFR-04 async).")
public class ContentGenerationController {

    ContentGenerationService contentGenerationService;

    // NFR-04: trả về job ngay lập tức, xử lý nền qua AI service.
    @PostMapping("/generate")
    @Operation(summary = "Start generating a content item",
            description = "Starts an async job that calls the AI service; the strategy must be ACTIVE (BR-13).")
    public ApiResponse<ContentGenerationJobResponse> start(@AuthenticationPrincipal UserDetails principal,
                                                           @Valid @RequestBody ContentGenerationRequest request) {
        return contentGenerationService.startGeneration(principal.getUsername(), request);
    }

    @GetMapping("/jobs/{jobId}")
    @Operation(summary = "Get a content-generation job's status",
            description = "Polled by the frontend until status is SUCCESS or FAILED.")
    public ApiResponse<ContentGenerationJobResponse> getJob(@AuthenticationPrincipal UserDetails principal,
                                                            @PathVariable UUID jobId) {
        return contentGenerationService.getJob(principal.getUsername(), jobId);
    }
}
