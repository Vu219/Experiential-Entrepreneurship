package com.aima.controller;

import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.request.ContentItemStatusRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentFormattingJobResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.service.ContentFormattingService;
import com.aima.service.ContentItemService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/content-items")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Content Item", description = "View, manually edit, review and platform-format generated content (FR-33, FR-34, FR-40..FR-46).")
public class ContentItemController {

    ContentItemService contentItemService;
    ContentFormattingService contentFormattingService;

    @GetMapping("/{itemId}")
    @Operation(summary = "Get one content item",
            description = "Returns the item with its lifecycle status; scoped to the caller's brand profiles.")
    public ApiResponse<ContentItemResponse> getItem(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID itemId) {
        return contentItemService.getItem(principal.getUsername(), itemId);
    }

    @PutMapping("/{itemId}")
    @Operation(summary = "Manually edit a content item (FR-33)",
            description = "Partial update of script/caption/hashtags/CTA/media prompt; only allowed before the "
                    + "posting pipeline (DRAFT/GENERATED/NEED_REVIEW/APPROVED). Editing an APPROVED item moves it "
                    + "back to NEED_REVIEW.")
    public ApiResponse<ContentItemResponse> updateItem(@AuthenticationPrincipal UserDetails principal,
                                                       @PathVariable UUID itemId,
                                                       @Valid @RequestBody ContentItemUpdateRequest request) {
        return contentItemService.updateItem(principal.getUsername(), itemId, request);
    }

    @PatchMapping("/{itemId}/status")
    @Operation(summary = "Review flow status change (FR-34)",
            description = "Allowed transitions: GENERATED→NEED_REVIEW (submit for review), NEED_REVIEW→APPROVED (approve).")
    public ApiResponse<ContentItemResponse> updateStatus(@AuthenticationPrincipal UserDetails principal,
                                                         @PathVariable UUID itemId,
                                                         @Valid @RequestBody ContentItemStatusRequest request) {
        return contentItemService.updateStatus(principal.getUsername(), itemId, request);
    }

    // NFR-04: định dạng là tác vụ AI chạy nền — trả job ngay, FE poll.
    @PostMapping("/{itemId}/format")
    @Operation(summary = "Start platform formatting (FR-40..FR-46, BR-04)",
            description = "Starts an async job that formats the item into one ContentVersion per requested platform; "
                    + "the item must be GENERATED or APPROVED. Re-formatting soft-deletes the replaced versions.")
    public ApiResponse<ContentFormattingJobResponse> startFormatting(@AuthenticationPrincipal UserDetails principal,
                                                                     @PathVariable UUID itemId,
                                                                     @Valid @RequestBody ContentFormatRequest request) {
        return contentFormattingService.startFormatting(principal.getUsername(), itemId, request);
    }

    @GetMapping("/format-jobs/{jobId}")
    @Operation(summary = "Get a formatting job's status",
            description = "Polled by the frontend until status is SUCCESS or FAILED; includes the item's current versions.")
    public ApiResponse<ContentFormattingJobResponse> getFormattingJob(@AuthenticationPrincipal UserDetails principal,
                                                                      @PathVariable UUID jobId) {
        return contentFormattingService.getJob(principal.getUsername(), jobId);
    }
}
