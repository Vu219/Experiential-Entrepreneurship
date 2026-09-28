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

    /** Ping /me, cập nhật trạng thái + lastValidatedAt. Nhận ID: entity được load lại trong transaction. */
    PlatformAccount validate(UUID connectionId);

    /** Làm mới long-lived token (nếu loại token hỗ trợ). Nhận ID: entity được load lại trong transaction. */
    PlatformAccount refresh(UUID connectionId);

    /**
     * Soft delete kết nối {@code connectionId} của {@code userId} cùng các kết nối con; lịch SCHEDULED → ON_HOLD;
     * revoke phía nền tảng best-effort sau commit. Không tìm thấy → {@code CONNECTION_NOT_FOUND}.
     */
    void disconnect(UUID userId, UUID connectionId);

    /**
     * Data Deletion Callback: mọi kết nối Facebook gốc có {@code platformUserId} (ở mọi user AIMA)
     * cùng Trang/IG con bị soft delete + xoá token; lịch SCHEDULED → ON_HOLD.
     */
    CleanupResult deleteFacebookUserData(String platformUserId);

    /** Deauthorize Callback: các kết nối đó (kèm con) → REVOKED; lịch SCHEDULED → ON_HOLD. */
    CleanupResult revokeFacebookUser(String platformUserId);

    /**
     * Trước khi XOÁ CỨNG tài khoản: gom token các kết nối gốc của user rồi revoke phía Meta SAU
     * khi transaction xoá commit (rollback → không revoke). Không có transaction → revoke ngay.
     */
    void revokeAllForUserAfterCommit(UUID userId);

    /** Số kết nối bị ảnh hưởng + số lịch chuyển ON_HOLD. */
    record CleanupResult(int connections, int schedulesHeld) {
    }
}
