package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlansResponse;
import com.aima.service.PlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/plans")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Plans", description = "Gói dịch vụ công khai cho landing page.")
public class PlanController {

    PlanService planService;

    @GetMapping("/public")
    @SecurityRequirements({})
    @Operation(summary = "Gói dịch vụ + bảng so sánh cho landing (public)",
            description = "Chỉ trả gói isActive, sắp theo displayOrder. Không cần đăng nhập.")
    public ApiResponse<PlansResponse> getPublic() {
        return planService.getPublic();
    }
}
