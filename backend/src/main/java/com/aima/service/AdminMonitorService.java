package com.aima.service;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminFailedPostSummaryResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemActivityResponse;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;

import java.time.LocalDate;

/**
 * Giám sát hệ thống cho admin (FR-81..FR-83): tổng quan sức khỏe + bài thất bại/bị từ chối.
 */
public interface AdminMonitorService {

    /**
     * Bộ lọc của trang "Bài đăng lỗi & bị từ chối" — gom vào một record thay vì 6 tham số rời
     * (cùng mẫu {@code ActivityLogService.Filter}), để list/summary/export dùng chung một khai báo.
     *
     * @param filter        tab: POLICY (bị từ chối, FR-82) / TECHNICAL (lỗi hệ thống, FR-83) / ALL
     * @param violationOnly cờ CŨ của {@code GET /admin/posts/failed}; true ⇒ ép filter về POLICY.
     *                      Giữ lại để không phá caller đã tích hợp trước đó
     * @param platform      lọc theo nền tảng; null = tất cả
     * @param errorType     lọc mịn theo loại lỗi gốc; null = tất cả
     * @param from          ngày bắt đầu (bao gồm); null = không giới hạn
     * @param to            ngày kết thúc, BAO GỒM cả ngày đó; null = không giới hạn
     * @param q             tìm trong caption / email chủ bài / tên tài khoản đăng
     */
    record FailedPostFilterQuery(FailedPostFilter filter, boolean violationOnly, Platform platform,
                                 PublishErrorType errorType, LocalDate from, LocalDate to, String q) {
    }

    /** FR-81: health + chỉ số thật của dependency (DB/Redis/AI service) + tài nguyên + alert lỗi mới nhất. */
    ApiResponse<AdminSystemStatusResponse> systemStatus();

    /** FR-82/FR-83: bài FAILED toàn hệ thống, lọc/tìm/sắp xếp/phân trang server-side. */
    ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(FailedPostFilterQuery query,
                                                                       boolean ascending, int page, int size);

    /**
     * 4 thẻ KPI + số đếm badge 2 tab, kèm % lệch kỳ trước liền kề và chuỗi đếm theo ngày.
     * `kind` quyết định phạm vi của thẻ "Tổng" và "Người dùng bị ảnh hưởng": TECHNICAL chỉ tính
     * bài lỗi kỹ thuật, còn lại tính toàn bộ bài lỗi trong kỳ.
     */
    ApiResponse<AdminFailedPostSummaryResponse> failedPostSummary(FailedPostFilter kind,
                                                                  LocalDate from, LocalDate to);

    /** Export CSV theo ĐÚNG bộ lọc đang chọn; vượt trần 50.000 dòng thì báo lỗi, không cắt cụt. */
    ApiResponse<String> exportFailedPosts(FailedPostFilterQuery query);

    /** Biểu đồ hoạt động hệ thống theo khoảng: 1h | 24h | 7d | 30d | 1y (suy từ dữ liệu có timestamp). */
    ApiResponse<SystemActivityResponse> systemActivity(String range);
}
