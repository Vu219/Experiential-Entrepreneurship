package com.aima.controller;

import com.aima.dto.response.ActivityLogResponse;
import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminFailedPostSummaryResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemActivityResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.enums.FailedPostFilter;
import com.aima.enums.LogLevel;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorType;
import com.aima.service.ActivityLogService;
import com.aima.service.AdminMonitorService;
import com.aima.service.SystemLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Admin Monitoring", description = "System status, failed/rejected posts and system logs (FR-81..FR-84). ADMIN only.")
public class AdminMonitorController {

    AdminMonitorService adminMonitorService;
    SystemLogService systemLogService;
    ActivityLogService activityLogService;

    @GetMapping("/system")
    @Operation(summary = "System status overview (FR-81)",
            description = "Health + chỉ số thật của database/redis/AI service, tài nguyên container, counters và ERROR alerts.")
    public ApiResponse<AdminSystemStatusResponse> systemStatus() {
        return adminMonitorService.systemStatus();
    }

    @GetMapping("/system/activity")
    @Operation(summary = "System activity chart (khối lượng nghiệp vụ theo thời gian)",
            description = "Suy từ dữ liệu có timestamp (bài POSTED, posting jobs, log ERROR) gộp theo bucket. "
                    + "range: 1h | 24h | 7d | 30d | 1y (mặc định 24h). Không phải %CPU.")
    public ApiResponse<SystemActivityResponse> systemActivity(
            @RequestParam(defaultValue = "24h") String range) {
        return adminMonitorService.systemActivity(range);
    }

    @GetMapping("/posts/failed")
    @Operation(summary = "Failed posts across all users (FR-82/FR-83)",
            description = "Phân trang + lọc + tìm kiếm server-side, mặc định thất bại mới nhất trước. "
                    + "filter = ALL | POLICY (bị nền tảng từ chối, FR-82) | TECHNICAL (lỗi hệ thống, FR-83); "
                    + "lọc thêm platform / errorType / khoảng ngày (to BAO GỒM cả ngày đó) / q "
                    + "(caption, email chủ bài, tên tài khoản đăng). sort = 'failedAt,asc' để đảo chiều. "
                    + "violationOnly giữ nguyên cho caller cũ — true ⇒ ép filter về POLICY. "
                    + "Ngày ở đây là THỜI ĐIỂM THẤT BẠI (end_time của job FAILED muộn nhất).")
    public ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(
            @RequestParam(defaultValue = "ALL") FailedPostFilter filter,
            @RequestParam(defaultValue = "false") boolean violationOnly,
            @RequestParam(required = false) Platform platform,
            @RequestParam(required = false) PublishErrorType errorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "failedAt,desc") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        AdminMonitorService.FailedPostFilterQuery query =
                new AdminMonitorService.FailedPostFilterQuery(filter, violationOnly, platform, errorType, from, to, q);
        return adminMonitorService.listFailedPosts(query, sort.endsWith("asc"), page, size);
    }

    @GetMapping("/posts/failed/summary")
    @Operation(summary = "KPI block for the failed/rejected posts page (FR-82/FR-83)",
            description = "Trả CẢ 6 chỉ số để client dựng 2 bộ thẻ: tab \"Bị từ chối\" dùng total / "
                    + "policyViolation / technical / affectedUsers; tab \"Lỗi hệ thống\" dùng total / temporary "
                    + "/ permanent / affectedUsers. `kind` chỉ đổi PHẠM VI của total + affectedUsers "
                    + "(TECHNICAL ⇒ chỉ bài lỗi kỹ thuật). Mỗi thẻ kèm deltaState (PERCENT | NEW | NONE) + "
                    + "deltaPct so với kỳ trước LIỀN KỀ và chuỗi đếm theo ngày (zero-fill) cho sparkline. "
                    + "Số đếm badge của 2 tab cũng lấy từ đây. Tối đa 366 ngày.")
    public ApiResponse<AdminFailedPostSummaryResponse> failedPostSummary(
            @RequestParam(defaultValue = "POLICY") FailedPostFilter kind,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return adminMonitorService.failedPostSummary(kind, from, to);
    }

    @GetMapping("/posts/failed/export")
    @Operation(summary = "Export CSV bài lỗi theo ĐÚNG bộ lọc đang chọn",
            description = "CSV dạng chuỗi trong result (FE tự tạo file) — cùng quy ước với export log hoạt "
                    + "động. Vượt 50.000 dòng → lỗi 2062, KHÔNG cắt cụt im lặng.")
    public ApiResponse<String> exportFailedPosts(
            @RequestParam(defaultValue = "ALL") FailedPostFilter filter,
            @RequestParam(defaultValue = "false") boolean violationOnly,
            @RequestParam(required = false) Platform platform,
            @RequestParam(required = false) PublishErrorType errorType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q) {
        AdminMonitorService.FailedPostFilterQuery query =
                new AdminMonitorService.FailedPostFilterQuery(filter, violationOnly, platform, errorType, from, to, q);
        return adminMonitorService.exportFailedPosts(query);
    }

    @GetMapping("/logs")
    @Operation(summary = "System logs — tab \"Log lỗi hệ thống\" (FR-84)",
            description = "Paged, newest first; lọc level + ngày (yyyy-MM-dd) + tìm kiếm q (message/module); "
                    + "grouped=true gom dòng trùng thành 1 dòng kèm số đếm (×N) + thời điểm mới nhất. "
                    + "Các dòng module admin.* KHÔNG hiện ở đây — đó là dấu vết nghiệp vụ, xem tab hoạt động.")
    public ApiResponse<PageResponse<SystemLogResponse>> listLogs(
            @RequestParam(required = false) LogLevel level,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean grouped,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return systemLogService.list(level, date, q, grouped, page, size);
    }

    @GetMapping("/logs/activity")
    @Operation(summary = "Log hoạt động người dùng — tab \"Log hoạt động người dùng\"",
            description = "Bảng RIÊNG activity_logs (không phải log lỗi). Phân trang offset, mới nhất trước; "
                    + "q tìm theo tên/email, lọc action + userId + result + khoảng ngày (to BAO GỒM cả ngày đó). "
                    + "Ngày hiểu theo múi giờ ứng dụng (APP_TIMEZONE).")
    public ApiResponse<PageResponse<ActivityLogResponse>> listActivityLogs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ActivityAction action,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) ActivityResult result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        ActivityLogService.Filter filter = new ActivityLogService.Filter(from, to, userId, action, result, q);
        return activityLogService.list(filter, page, size);
    }

    @GetMapping("/logs/activity/{id}")
    @Operation(summary = "Chi tiết một hành động — metadata đầy đủ cho panel chi tiết")
    public ApiResponse<ActivityLogResponse> getActivityLog(@PathVariable UUID id) {
        return activityLogService.get(id);
    }

    @GetMapping("/logs/activity/export")
    @Operation(summary = "Export CSV log hoạt động theo ĐÚNG bộ lọc đang chọn",
            description = "CSV dạng chuỗi trong result (FE tự tạo file) — cùng quy ước với export nhật ký "
                    + "usage. Vượt 50.000 dòng → lỗi 2044, KHÔNG cắt cụt im lặng.")
    public ApiResponse<String> exportActivityLogs(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ActivityAction action,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) ActivityResult result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ActivityLogService.Filter filter = new ActivityLogService.Filter(from, to, userId, action, result, q);
        return activityLogService.exportCsv(principal.getUsername(), filter);
    }
}
