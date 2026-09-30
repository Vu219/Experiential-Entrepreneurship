package com.aima.controller;

import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.request.ContentItemCreateRequest;
import com.aima.dto.request.ContentItemReviewRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.ContentWizardStateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentFormattingJobResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.Platform;
import com.aima.enums.ReviewStatus;
import com.aima.service.ContentFormattingService;
import com.aima.service.ContentItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/content-items")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Content Item", description = "View, manually edit, review and platform-format generated content (FR-33, FR-34, FR-40..FR-46).")
public class ContentItemController {

    ContentItemService contentItemService;
    ContentFormattingService contentFormattingService;

    @GetMapping
    @Operation(summary = "Content library — list/filter/search (FR-87)",
            description = "Paged. Optional filters: status (aggregate), reviewStatus, brandProfileId, platform (of formatted versions), "
                    + "industry, fromDate/toDate (ISO date, on createdAt), q (keyword in caption/script). "
                    + "sort = newest (default) | voice (highest brand-voice score) | status (grouped).")
    public ApiResponse<PageResponse<ContentItemResponse>> list(@AuthenticationPrincipal UserDetails principal,
                                                               @RequestParam(required = false) ContentItemStatus status,
                                                               @RequestParam(required = false) ReviewStatus reviewStatus,
                                                               @RequestParam(required = false) UUID brandProfileId,
                                                               @RequestParam(required = false) Platform platform,
                                                               @RequestParam(required = false) String industry,
                                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
                                                               @RequestParam(required = false) String q,
                                                               @RequestParam(defaultValue = "newest") String sort,
                                                               @RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "10") int size) {
        return contentItemService.list(principal.getUsername(), status, reviewStatus, brandProfileId, platform, industry, fromDate, toDate, q, sort, page, size);
    }

    // B2: bài là MỘT thực thể — tạo shell DRAFT trước, các job generate ghi version vào.
    @PostMapping
    @Operation(summary = "Create a content item shell (B2)",
            description = "Creates one DRAFT item under the strategy's brand profile; per-platform "
                    + "generation jobs then write one rich ContentVersion each into it.")
    public ApiResponse<ContentItemResponse> create(@AuthenticationPrincipal UserDetails principal,
                                                   @Valid @RequestBody ContentItemCreateRequest request) {
        return contentItemService.create(principal.getUsername(), request);
    }

    @GetMapping("/{itemId}")
    @Operation(summary = "Get one content item",
            description = "Returns the item with its lifecycle status; scoped to the caller's brand profiles.")
    public ApiResponse<ContentItemResponse> getItem(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID itemId) {
        return contentItemService.getItem(principal.getUsername(), itemId);
    }

    @DeleteMapping("/{itemId}")
    @Operation(summary = "Delete a content item (FR-89)",
            description = "Only before scheduling and before review (reviewStatus NONE/CHANGES_REQUESTED); soft-deletes "
                    + "the item and cascades to its ContentVersions and MediaAssets. Items in the posting pipeline cannot be deleted.")
    public ApiResponse<ContentItemResponse> delete(@AuthenticationPrincipal UserDetails principal,
                                                   @PathVariable UUID itemId) {
        return contentItemService.delete(principal.getUsername(), itemId);
    }

    @PutMapping("/{itemId}")
    @Operation(summary = "Manually edit a content item (FR-33)",
            description = "Partial update of script/caption/hashtags/CTA/media prompt; allowed while the aggregate status "
                    + "is DRAFT/GENERATED/FORMATTED/FAILED/PARTIALLY_POSTED. Editing an APPROVED item moves its reviewStatus "
                    + "back to NEED_REVIEW.")
    public ApiResponse<ContentItemResponse> updateItem(@AuthenticationPrincipal UserDetails principal,
                                                       @PathVariable UUID itemId,
                                                       @Valid @RequestBody ContentItemUpdateRequest request) {
        return contentItemService.updateItem(principal.getUsername(), itemId, request);
    }

    // B2/FR-33: sửa thủ công một BẢN NỀN TẢNG trong bài (partial update).
    @PutMapping("/{itemId}/versions/{versionId}")
    @Operation(summary = "Manually edit one per-platform version (B2, FR-33)",
            description = "Partial update of script/caption/hashtags/CTA/media prompt on one ContentVersion; "
                    + "same status rules as editing the item — editing an APPROVED item moves its reviewStatus back to NEED_REVIEW.")
    public ApiResponse<ContentItemResponse> updateVersion(@AuthenticationPrincipal UserDetails principal,
                                                          @PathVariable UUID itemId,
                                                          @PathVariable UUID versionId,
                                                          @Valid @RequestBody ContentVersionUpdateRequest request) {
        return contentItemService.updateVersion(principal.getUsername(), itemId, versionId, request);
    }

    // Auto-save trạng thái wizard (bài DRAFT) — FE debounce ~1s, "Tiếp tục" resume đúng bước.
    @PatchMapping("/{itemId}/wizard-state")
    @Operation(summary = "Auto-save wizard progress on an unsubmitted item",
            description = "Stores the wizard step (1-4), picked platforms, attached trend/idea and AI note so the "
                    + "user can resume the draft at the right step; only allowed while the item has no active schedule "
                    + "and reviewStatus is NONE. Fields are cleared automatically when the item is submitted for review.")
    public ApiResponse<ContentItemResponse> updateWizardState(@AuthenticationPrincipal UserDetails principal,
                                                              @PathVariable UUID itemId,
                                                              @Valid @RequestBody ContentWizardStateRequest request) {
        return contentItemService.updateWizardState(principal.getUsername(), itemId, request);
    }

    @PatchMapping("/{itemId}/review")
    @Operation(summary = "Review flow change (FR-34)",
            description = "Changes reviewStatus only (the aggregate status is derived). Allowed: NONE/CHANGES_REQUESTED→NEED_REVIEW "
                    + "(submit), NEED_REVIEW→APPROVED (approve), NEED_REVIEW→CHANGES_REQUESTED (return for edits). "
                    + "Sending the current reviewStatus again is a no-op.")
    public ApiResponse<ContentItemResponse> updateReview(@AuthenticationPrincipal UserDetails principal,
                                                         @PathVariable UUID itemId,
                                                         @Valid @RequestBody ContentItemReviewRequest request) {
        return contentItemService.updateReview(principal.getUsername(), itemId, request);
    }

    // NFR-04: định dạng là tác vụ AI chạy nền — trả job ngay, FE poll.
    @PostMapping("/{itemId}/format")
    @Operation(summary = "Start platform formatting (FR-40..FR-46, BR-04)",
            description = "Starts an async job that formats the item into one ContentVersion per requested platform; "
                    + "the item must have no active schedule (DRAFT/GENERATED/FORMATTED). Re-formatting soft-deletes the replaced versions.")
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
