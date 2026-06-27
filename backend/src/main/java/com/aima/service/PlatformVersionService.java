package com.aima.service;

import com.aima.dto.request.UpdateVersionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ApiVersionHistoryResponse;
import com.aima.dto.response.ApiVersionResponse;
import com.aima.enums.Platform;

import java.util.List;

/**
 * Quản lý version API nền tảng (Admin) + cấp version hiện hành cho {@code MetaApiClient}.
 */
public interface PlatformVersionService {

    ApiResponse<List<ApiVersionResponse>> getAllVersions();

    ApiResponse<List<ApiVersionHistoryResponse>> getVersionHistory(Platform platform);

    ApiResponse<ApiVersionResponse> updateVersion(Platform platform, UpdateVersionRequest request, String adminEmail);

    ApiResponse<List<ApiVersionResponse>> checkVersionsManually();

    /** Version hiện hành (vd "v25.0") — có cache 5 phút, dùng bởi MetaApiClient. */
    String getCurrentVersion(Platform platform);

    /** Job tự động gọi: cập nhật latestVersion/status cho mọi nền tảng. */
    void runVersionCheck();
}
