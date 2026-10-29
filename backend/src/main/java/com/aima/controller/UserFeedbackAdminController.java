package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FeedbackResponse;
import com.aima.dto.response.FeedbackSummaryResponse;
import com.aima.dto.response.PageResponse;
import com.aima.service.UserFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/feedback")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Feedback", description = "Xem đánh giá & góp ý của người dùng (ADMIN).")
public class UserFeedbackAdminController {

    UserFeedbackService feedbackService;

    @GetMapping
    @Operation(summary = "Danh sách đánh giá mới nhất trước, lọc theo số sao")
    public ApiResponse<PageResponse<FeedbackResponse>> list(@RequestParam(required = false) Short rating,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return feedbackService.list(rating, page, size);
    }

    @PostMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY (cờ aima.dev.feedback-seed-enabled, mặc định tắt — mã 2219): sinh đánh giá MÔ PHỎNG "
            + "14 ngày gần nhất để dựng/demo trang. Bị chặn khi production-mode; không phải đánh giá thật")
    public ApiResponse<Integer> devSeed(@AuthenticationPrincipal UserDetails principal) {
        return feedbackService.devSeed(principal.getUsername());
    }

    @DeleteMapping("/dev-seed")
    @Operation(summary = "DEV-ONLY: xoá mọi đánh giá mô phỏng do dev-seed sinh")
    public ApiResponse<Integer> devSeedClear(@AuthenticationPrincipal UserDetails principal) {
        return feedbackService.devSeedClear(principal.getUsername());
    }

    @GetMapping("/summary")
    @Operation(summary = "Tổng lượt, điểm trung bình và phân bố theo số sao")
    public ApiResponse<FeedbackSummaryResponse> summary() {
        return feedbackService.summary();
    }
}
