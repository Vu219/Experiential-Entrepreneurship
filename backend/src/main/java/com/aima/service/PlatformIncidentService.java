package com.aima.service;

import com.aima.dto.response.PlatformIncidentResponse;
import com.aima.enums.Platform;

import java.util.List;

/**
 * Phát hiện sự cố nền tảng (docs/failed-posts-error-handling-plan.md §2 mục 6): trong cửa sổ gần đây, một nền tảng có
 * ≥ N lần lỗi tạm thời từ ≥ M kết nối khác nhau → coi là sự cố diện rộng. Khi đó lỗi tạm thời mới được đánh mã
 * {@code PLATFORM_OUTAGE}, retry của nền tảng đó bị HOÃN (không tiêu lượt) và người dùng/admin thấy banner.
 * Tính từ {@code posting_jobs} (không bảng trạng thái riêng) → nhiều instance cho cùng kết quả; cache ngắn.
 */
public interface PlatformIncidentService {

    /** Sự cố đang mở (cache ~60s). Lỗi đọc DB → danh sách rỗng (không bao giờ chặn luồng đăng bài). */
    List<PlatformIncidentResponse> activeIncidents();

    boolean isActive(Platform platform);
}
