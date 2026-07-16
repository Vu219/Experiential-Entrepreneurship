package com.aima.security;

/**
 * Quyền GHI cấu hình AI (key/model/routing) — MỘT nguồn duy nhất cho mọi
 * {@code @PreAuthorize} trên các endpoint ghi của {@code AiConfigAdminController}.
 * Nâng cấp lên SUPER_ADMIN sau này = sửa đúng MỘT dòng hằng số dưới đây
 * (vd {@code "hasRole('SUPER_ADMIN')"}), không sửa rải rác từng endpoint.
 */
public final class AiConfigAccess {

    public static final String WRITE = "hasRole('ADMIN')";

    private AiConfigAccess() {
    }
}
