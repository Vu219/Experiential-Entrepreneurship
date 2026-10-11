package com.aima.controller;

import com.aima.dto.request.FailedPostBulkRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FailedPostBulkResponse;
import com.aima.dto.response.FailedPostDetailResponse;
import com.aima.dto.response.FailedPostResponse;
import com.aima.dto.response.FailedPostRetryResponse;
import com.aima.dto.response.FailedPostSummaryResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.FailedPostStateFilter;
import com.aima.service.FailedPostService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * FR-35..FR-39 — trung tâm hồi phục bài lỗi của CHÍNH user. Khác admin (FR-82/83/84, góc nhìn toàn
 * hệ thống) và NotificationBell (hộp thư). Người dùng chỉ nhận mã lỗi chuẩn hoá — không có message gốc.
 */
@RestController
@RequestMapping("/me/failed-posts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Failed Posts", description = "User recovery center for the caller's own failed/rejected posts (FR-35..FR-39).")
public class FailedPostController {

    FailedPostService failedPostService;

    @GetMapping
    @Operation(summary = "List the caller's failed posts (FR-35..FR-39)",
            description = "Paged. filter = ALL | POLICY | TECHNICAL (by the latest failure's coarse type). "
                    + "state = NEEDS_ACTION (default — same set as before lifecycles existed) | AUTO_RETRYING | DISMISSED "
                    + "| ACTIVE (needs action + auto retrying) | ALL. Each row carries the normalized error code, "
                    + "available actions, lifecycle and the ids needed for recovery.")
    public ApiResponse<PageResponse<FailedPostResponse>> list(@AuthenticationPrincipal UserDetails principal,
                                                              @RequestParam(defaultValue = "ALL") FailedPostFilter filter,
                                                              @RequestParam(defaultValue = "NEEDS_ACTION") FailedPostStateFilter state,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "10") int size) {
        return failedPostService.list(principal.getUsername(), filter, state, page, size);
    }

    @GetMapping("/summary")
    @Operation(summary = "Failure overview counts",
            description = "total / policy / technical (final failures) + needsAction / autoRetrying / dismissed.")
    public ApiResponse<FailedPostSummaryResponse> summary(@AuthenticationPrincipal UserDetails principal) {
        return failedPostService.summary(principal.getUsername());
    }

    @GetMapping("/platform-status")
    @Operation(summary = "Platforms with an ongoing outage",
            description = "Nền tảng đang có nhiều lỗi tạm thời từ nhiều tài khoản — AIMA tạm hoãn tự thử lại (banner).")
    public ApiResponse<List<PlatformIncidentResponse>> platformStatus() {
        return failedPostService.platformStatus();
    }

    @GetMapping("/{postId}")
    @Operation(summary = "One failed post with its attempt timeline")
    public ApiResponse<FailedPostDetailResponse> get(@AuthenticationPrincipal UserDetails principal,
                                                     @PathVariable UUID postId) {
        return failedPostService.get(principal.getUsername(), postId);
    }

    @PostMapping("/{postId}/retry")
    @Operation(summary = "Retry a failed post now (FR-58)",
            description = "FAILED schedule → published right away in the background. Refused when the account is not "
                    + "ACTIVE (2064), when a content error was not edited yet (2065) or when retrying cannot help (2066).")
    public ApiResponse<FailedPostRetryResponse> retry(@AuthenticationPrincipal UserDetails principal,
                                                      @PathVariable UUID postId) {
        return failedPostService.retry(principal.getUsername(), postId);
    }

    @PostMapping("/{postId}/dismiss")
    @Operation(summary = "Dismiss a failed post (hide it from 'needs action')")
    public ApiResponse<FailedPostResponse> dismiss(@AuthenticationPrincipal UserDetails principal,
                                                   @PathVariable UUID postId) {
        return failedPostService.dismiss(principal.getUsername(), postId);
    }

    @PostMapping("/bulk")
    @Operation(summary = "Retry or dismiss up to 50 failed posts",
            description = "Each post runs in its own transaction; per-post code/message in the result.")
    public ApiResponse<FailedPostBulkResponse> bulk(@AuthenticationPrincipal UserDetails principal,
                                                    @Valid @RequestBody FailedPostBulkRequest request) {
        return failedPostService.bulk(principal.getUsername(), request);
    }
}
