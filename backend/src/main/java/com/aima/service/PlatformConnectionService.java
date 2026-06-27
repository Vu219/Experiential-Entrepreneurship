package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthorizationUrlResponse;
import com.aima.dto.response.ConnectionStatsResponse;
import com.aima.dto.response.PlatformConnectionResponse;
import com.aima.enums.Platform;

import java.util.List;
import java.util.UUID;

public interface PlatformConnectionService {

    ApiResponse<AuthorizationUrlResponse> getAuthorizationUrl(Platform platform, String email);

    /** Xử lý callback OAuth và trả về URL redirect FE (thành công hoặc lỗi). */
    String handleCallbackRedirect(Platform platform, String code, String state, String error);

    ApiResponse<List<PlatformConnectionResponse>> listConnections(String email);

    ApiResponse<ConnectionStatsResponse> getStats(String email);

    ApiResponse<PlatformConnectionResponse> validateConnection(UUID id, String email);

    ApiResponse<PlatformConnectionResponse> refreshConnection(UUID id, String email);

    ApiResponse<Void> disconnect(UUID id, String email);
}
