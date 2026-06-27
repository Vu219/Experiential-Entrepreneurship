package com.aima.service;

import com.aima.entity.PlatformAccount;
import com.aima.enums.Platform;

import java.util.List;
import java.util.UUID;

/**
 * Cơ chế OAuth liên kết tài khoản MXH với Meta. Không trả ApiResponse — lớp facade
 * {@code PlatformConnectionService} bọc kết quả thành envelope cho controller.
 */
public interface MetaOAuthService {

    /** Sinh state (lưu Redis TTL) và build URL OAuth dialog cho nền tảng. */
    String buildAuthorizationUrl(Platform platform, UUID userId);

    /** Xử lý callback: đổi code → token → lưu các kết nối. Trả về danh sách kết nối vừa tạo/cập nhật. */
    List<PlatformAccount> handleCallback(Platform platform, String code, String state);

    /** Ping /me, cập nhật trạng thái + lastValidatedAt. */
    PlatformAccount validate(PlatformAccount account);

    /** Làm mới long-lived token (nếu loại token hỗ trợ). */
    PlatformAccount refresh(PlatformAccount account);

    /** Revoke phía nền tảng + soft delete kết nối và các kết nối con. */
    void disconnect(PlatformAccount account);
}
