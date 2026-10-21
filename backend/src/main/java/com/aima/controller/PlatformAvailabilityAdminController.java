package com.aima.controller;

import com.aima.dto.request.PlatformAvailabilityRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlatformAvailabilityResponse;
import com.aima.enums.Platform;
import com.aima.service.PlatformAvailabilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/platforms")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Platform Availability", description = "Mở/khoá liên kết nền tảng toàn hệ thống (ADMIN).")
public class PlatformAvailabilityAdminController {

    PlatformAvailabilityService platformAvailabilityService;

    @GetMapping("/availability")
    @Operation(summary = "Trạng thái mở/khoá của 3 nền tảng + số kênh đang kết nối + số lịch chưa đăng")
    public ApiResponse<List<PlatformAvailabilityResponse>> list() {
        return platformAvailabilityService.list();
    }

    @PutMapping("/{platform}/availability")
    @Operation(summary = "Mở / khoá liên kết một nền tảng",
            description = "Khoá: bắt buộc lý do VI + EN; lịch chưa đăng của nền tảng chuyển Tạm giữ (PLATFORM_DISABLED) trong "
                    + "cùng transaction, mỗi user nhận một thông báo SCHEDULE_HELD. Mở: lịch vẫn Tạm giữ — user tự tiếp tục.")
    public ApiResponse<PlatformAvailabilityResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                            @PathVariable Platform platform,
                                                            @Valid @RequestBody PlatformAvailabilityRequest request) {
        return platformAvailabilityService.update(platform, request, principal.getUsername());
    }
}
