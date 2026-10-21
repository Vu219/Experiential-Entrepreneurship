package com.aima.service;

import com.aima.dto.request.PlatformAvailabilityRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlatformAccessListResponse;
import com.aima.dto.response.PlatformAvailabilityResponse;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.PlatformLockReason;

import java.util.List;
import java.util.Map;

/**
 * Nơi DUY NHẤT trả lời "nền tảng có dùng được không" (Flyway V20, bảng {@code platform_availability}).
 * Quyền thực tế của một user = nền tảng MỞ ở cấp hệ thống VÀ được gói cho phép (ALLOWED_PLATFORMS) — khoá hệ thống
 * luôn được kiểm trước và luôn thắng.
 *
 * <p>Trạng thái hệ thống được cache trong process {@link #CACHE_TTL} (xoá ngay khi admin đổi trên instance này); các
 * kiểm tra sớm / hiển thị đọc cache, lần kiểm tra CUỐI ngay trước khi gọi Meta dùng {@link #lockReasonNow} (đọc DB).</p>
 */
public interface PlatformAvailabilityService {

    java.time.Duration CACHE_TTL = java.time.Duration.ofSeconds(30);

    /** Nền tảng đang mở ở cấp hệ thống (cache). */
    boolean isEnabled(Platform platform);

    /** Kết nối mới / kết nối lại: khoá hệ thống → PLATFORM_CONNECTION_DISABLED (1835). */
    void requireConnectable(Platform platform);

    /** Lý do user không dùng được nền tảng (null = dùng được) — cache cho phần hệ thống. */
    PlatformLockReason lockReason(User user, Platform platform);

    /** Như {@link #lockReason} nhưng đọc trạng thái hệ thống thẳng từ DB (worker, ngay trước khi gọi nền tảng). */
    PlatformLockReason lockReasonNow(User user, Platform platform);

    /** Mọi nền tảng → lý do khoá của user (null = dùng được); danh sách kết nối / tài khoản đăng được. */
    Map<Platform, PlatformLockReason> lockReasons(User user);

    /**
     * Lên lịch / dời / đăng ngay: khoá hệ thống → SCHEDULE_PLATFORM_DISABLED (2210); gói không gồm nền tảng →
     * PLAN_FEATURE_NOT_INCLUDED (2206, limitKey ALLOWED_PLATFORMS).
     */
    void requireUsable(User user, Platform platform);

    /** GET /connections/platforms — quyền dùng từng nền tảng + số kênh còn được kết nối. */
    ApiResponse<PlatformAccessListResponse> myPlatforms(String email);

    /** Admin: trạng thái + mức ảnh hưởng của từng nền tảng. */
    ApiResponse<List<PlatformAvailabilityResponse>> list();

    /**
     * Admin mở/khoá. Khoá: trong CÙNG transaction giữ mọi lịch chưa đăng của nền tảng (PLATFORM_DISABLED) + một
     * thông báo SCHEDULE_HELD / user. Mở: chỉ đổi trạng thái — lịch vẫn ON_HOLD, user tự tiếp tục từng lịch.
     */
    ApiResponse<PlatformAvailabilityResponse> update(Platform platform, PlatformAvailabilityRequest request, String adminEmail);

    /**
     * Seed lần đầu (initializer): tạo dòng còn thiếu theo env {@code aima.connections.enabled-platforms}; nền tảng VỪA
     * được seed ở trạng thái khoá thì giữ lịch chưa đăng như luồng admin khoá. Idempotent — dòng đã có thì bỏ qua.
     *
     * @return số lịch vừa chuyển sang Tạm giữ
     */
    int seedDefaults();
}
