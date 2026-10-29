package com.aima.controller;

import com.aima.dto.request.FeedbackRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FeedbackResponse;
import com.aima.service.UserFeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/feedback")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Feedback", description = "Đánh giá & góp ý của người dùng gửi từ trong app (G1.3).")
public class UserFeedbackController {

    UserFeedbackService feedbackService;

    @PostMapping
    @Operation(summary = "Gửi đánh giá 1–5 sao kèm nhận xét tuỳ chọn")
    public ApiResponse<FeedbackResponse> submit(@AuthenticationPrincipal UserDetails principal,
                                                @Valid @RequestBody FeedbackRequest request) {
        return feedbackService.submit(principal.getUsername(), request);
    }
}
