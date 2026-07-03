package com.aima.controller;

import com.aima.dto.request.UpdateVersionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ApiVersionHistoryResponse;
import com.aima.dto.response.ApiVersionResponse;
import com.aima.enums.Platform;
import com.aima.service.PlatformVersionService;
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
@RequestMapping("/admin/api-versions")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Platform API Versions", description = "Quản trị version API nền tảng (ADMIN).")
public class PlatformVersionAdminController {

    PlatformVersionService versionService;

    @GetMapping
    @Operation(summary = "Danh sách version API của 3 nền tảng")
    public ApiResponse<List<ApiVersionResponse>> list() {
        return versionService.getAllVersions();
    }

    @GetMapping("/{platform}/history")
    @Operation(summary = "Lịch sử thay đổi version của một nền tảng")
    public ApiResponse<List<ApiVersionHistoryResponse>> history(@PathVariable Platform platform) {
        return versionService.getVersionHistory(platform);
    }

    @PostMapping("/{platform}")
    @Operation(summary = "Cập nhật version hiện hành (áp dụng tức thì)")
    public ApiResponse<ApiVersionResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                  @PathVariable Platform platform,
                                                  @Valid @RequestBody UpdateVersionRequest request) {
        return versionService.updateVersion(platform, request, principal.getUsername());
    }

    @PostMapping("/check-now")
    @Operation(summary = "Chạy kiểm tra version mới ngay")
    public ApiResponse<List<ApiVersionResponse>> checkNow() {
        return versionService.checkVersionsManually();
    }
}
