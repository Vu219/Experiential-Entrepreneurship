package com.aima.controller;

import com.aima.dto.response.AdminOverviewSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.service.AdminOverviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * UI-10 — trang Quản trị → Tổng quan. Một endpoint gộp cho KPI + phân bổ gói + người dùng gần đây;
 * card "Tình trạng hệ thống" của trang này tái dùng {@code GET /admin/system} sẵn có.
 */
@RestController
@RequestMapping("/admin/overview")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Admin · Overview", description = "Số liệu tổng quan toàn hệ thống cho trang quản trị (UI-10). ADMIN only.")
public class AdminOverviewController {

    AdminOverviewService adminOverviewService;

    @GetMapping("/summary")
    @Operation(summary = "Số liệu gộp của trang Tổng quan quản trị",
            description = "Trả 4 thẻ KPI (tổng người dùng / hoạt động hôm nay / nội dung đã tạo / doanh thu "
                    + "định kỳ tháng — mỗi thẻ kèm % thay đổi so kỳ trước và chuỗi 7 điểm sparkline), phân bổ "
                    + "người dùng theo gói và danh sách người dùng đăng ký gần đây. Số liệu đọc thẳng từ DB, "
                    + "cache trong tiến trình 30 giây. limit ngoài khoảng 1..20 sẽ bị kẹp về biên, không báo lỗi.")
    public ApiResponse<AdminOverviewSummaryResponse> getSummary(@RequestParam(defaultValue = "5") int limit) {
        return adminOverviewService.getSummary(limit);
    }
}
