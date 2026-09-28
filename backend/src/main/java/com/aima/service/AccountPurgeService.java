package com.aima.service;

import java.util.UUID;

/**
 * Chuẩn bị XOÁ CỨNG một tài khoản (purge sau 30 ngày chờ xoá + admin xoá). Cascade JPA của
 * {@code User} chỉ phủ dữ liệu "của" user; các bảng còn lại trỏ FK tới {@code users} mà không
 * cascade được xử lý ở đây để lệnh DELETE không vỡ khoá ngoại:
 * <ul>
 *   <li>{@code payments} — ẨN DANH HOÁ (giữ chứng từ doanh thu, bỏ liên kết người mua + payload cổng);</li>
 *   <li>{@code token_credits} — xoá (số dư của chính user);</li>
 *   <li>{@code ai_usage} — cắt liên kết user + bỏ IP/User-Agent, giữ event cho tổng chi phí;</li>
 *   <li>FK "người thao tác" của admin (audit cấu hình AI, bảng giá, API version, điều chỉnh usage) — set NULL.</li>
 * </ul>
 * Kèm lên lịch revoke token Meta SAU commit. Phải gọi TRONG cùng transaction với lệnh xoá user.
 */
public interface AccountPurgeService {

    /** Ném {@code USER_HAS_PENDING_PAYMENT} nếu user còn đơn PENDING (cổng có thể báo PAID sau đó). */
    void prepareForHardDelete(UUID userId);
}
