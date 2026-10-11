package com.aima.controller;

import com.aima.dto.request.AiFixApplyRequest;
import com.aima.dto.request.AiFixStartRequest;
import com.aima.dto.request.PolicyCheckRequest;
import com.aima.dto.response.AiAssistJobResponse;
import com.aima.dto.response.AiAssistUsageResponse;
import com.aima.dto.response.AiFixApplyResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PolicyCheckResponse;
import com.aima.service.AiAssistService;
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

/**
 * AI hỗ trợ chính sách của CHÍNH user (failed-posts đợt 2): AI sửa bài vi phạm (chỉ khi bấm) và kiểm tra chính
 * sách trước khi đăng (chỉ cảnh báo). Mọi lời gọi AI chạy nền — API trả job/trạng thái ngay (NFR-04).
 */
@RestController
@RequestMapping("/me/ai-assist")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "AI Policy Assist", description = "AI fix of rejected posts + pre-publish policy check (warning only).")
public class AiAssistController {

    AiAssistService aiAssistService;

    @PostMapping("/fixes")
    @Operation(summary = "Start an AI rewrite of one platform version",
            description = "Only on user click. postId (failed post) must be a policy/content failure; without postId the "
                    + "rule filter must flag the content. Per-version limit, token quota and concurrency are enforced. "
                    + "Returns a PENDING job — poll GET /jobs/{id}.")
    public ApiResponse<AiAssistJobResponse> startFix(@AuthenticationPrincipal UserDetails principal,
                                                     @Valid @RequestBody AiFixStartRequest request) {
        return aiAssistService.startFix(principal.getUsername(), request);
    }

    @GetMapping("/jobs/{jobId}")
    @Operation(summary = "AI assist job status + result",
            description = "fix = original vs suggested caption/hashtags + changes; check = risk level + issues. "
                    + "stale = the version changed after the job was created.")
    public ApiResponse<AiAssistJobResponse> getJob(@AuthenticationPrincipal UserDetails principal,
                                                   @PathVariable UUID jobId) {
        return aiAssistService.getJob(principal.getUsername(), jobId);
    }

    @PostMapping("/fixes/{jobId}/apply")
    @Operation(summary = "Apply a (possibly edited) AI suggestion",
            description = "Saves through the normal version edit (limits, revision, review reset). action = SAVE | "
                    + "RETRY_NOW (retry the linked failed post right away).")
    public ApiResponse<AiFixApplyResponse> applyFix(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID jobId,
                                                    @Valid @RequestBody AiFixApplyRequest request) {
        return aiAssistService.applyFix(principal.getUsername(), jobId, request);
    }

    @GetMapping("/usage")
    @Operation(summary = "AI policy-assist limits of the current plan",
            description = "AI policy checks used this month / monthly limit and AI fixes per version, from the user's "
                    + "plan (admin-configurable). Limit null = unlimited, 0 = not included in the plan.")
    public ApiResponse<AiAssistUsageResponse> getUsage(@AuthenticationPrincipal UserDetails principal) {
        return aiAssistService.getUsage(principal.getUsername());
    }

    @PostMapping("/policy-check")
    @Operation(summary = "Pre-publish policy check (warning only)",
            description = "Free rule filter first; the AI is called only when it flags something, the user enabled the "
                    + "check, the plan has AI checks left and tokens remain. Cached by content hash — call again while "
                    + "aiStatus is PENDING/RUNNING to get the result.")
    public ApiResponse<PolicyCheckResponse> checkPolicy(@AuthenticationPrincipal UserDetails principal,
                                                        @Valid @RequestBody PolicyCheckRequest request) {
        return aiAssistService.checkPolicy(principal.getUsername(), request);
    }
}
