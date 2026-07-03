package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthorizationUrlResponse;
import com.aima.dto.response.ConnectionStatsResponse;
import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.enums.Platform;
import com.aima.service.PlatformConnectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/connections")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Platform Connections", description = "Liên kết tài khoản MXH (Facebook/Instagram/Threads).")
public class PlatformConnectionController {

    PlatformConnectionService connectionService;

    @GetMapping("/{platform}/authorize")
    @Operation(summary = "Lấy URL OAuth để liên kết tài khoản",
            description = "Trả về URL dialog OAuth của Meta cho nền tảng; FE redirect người dùng tới URL này.")
    public ApiResponse<AuthorizationUrlResponse> authorize(@AuthenticationPrincipal UserDetails principal,
                                                           @PathVariable Platform platform) {
        return connectionService.getAuthorizationUrl(platform, principal.getUsername());
    }

    @GetMapping("/{platform}/callback")
    @SecurityRequirements({})
    @Operation(summary = "OAuth callback từ Meta",
            description = "Meta redirect về đây kèm code & state. BE đổi token, lưu kết nối rồi redirect FE.")
    public ResponseEntity<Void> callback(@PathVariable Platform platform,
                                         @RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error) {
        String redirect = connectionService.handleCallbackRedirect(platform, code, state, error);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirect)).build();
    }

    @GetMapping
    @Operation(summary = "Danh sách kết nối của người dùng")
    public ApiResponse<List<PlatformConnectionResponse>> list(@AuthenticationPrincipal UserDetails principal) {
        return connectionService.listConnections(principal.getUsername());
    }

    @GetMapping("/stats")
    @Operation(summary = "Tổng quan kết nối (total/active/expired/error)")
    public ApiResponse<ConnectionStatsResponse> stats(@AuthenticationPrincipal UserDetails principal) {
        return connectionService.getStats(principal.getUsername());
    }

    @PostMapping("/{id}/validate")
    @Operation(summary = "Kiểm tra trạng thái một kết nối (ping /me)")
    public ApiResponse<PlatformConnectionResponse> validate(@AuthenticationPrincipal UserDetails principal,
                                                            @PathVariable UUID id) {
        return connectionService.validateConnection(id, principal.getUsername());
    }

    @PostMapping("/{id}/refresh")
    @Operation(summary = "Làm mới long-lived token của một kết nối")
    public ApiResponse<PlatformConnectionResponse> refresh(@AuthenticationPrincipal UserDetails principal,
                                                           @PathVariable UUID id) {
        return connectionService.refreshConnection(id, principal.getUsername());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Ngắt kết nối (revoke + soft delete)")
    public ApiResponse<Void> disconnect(@AuthenticationPrincipal UserDetails principal, @PathVariable UUID id) {
        return connectionService.disconnect(id, principal.getUsername());
    }
}
