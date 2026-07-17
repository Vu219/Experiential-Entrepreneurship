package com.aima.controller;

import com.aima.dto.response.AdminFailedPostResponse;
import com.aima.dto.response.AdminSystemStatusResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemActivityResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.enums.LogLevel;
import com.aima.service.AdminMonitorService;
import com.aima.service.SystemLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Admin Monitoring", description = "System status, failed/rejected posts and system logs (FR-81..FR-84). ADMIN only.")
public class AdminMonitorController {

    AdminMonitorService adminMonitorService;
    SystemLogService systemLogService;

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
            description = "Paged, newest failures first; violationOnly=true returns only policy-rejected posts (FR-82).")
    public ApiResponse<PageResponse<AdminFailedPostResponse>> listFailedPosts(
            @RequestParam(defaultValue = "false") boolean violationOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return adminMonitorService.listFailedPosts(violationOnly, page, size);
    }

    @GetMapping("/logs")
    @Operation(summary = "System logs (FR-84)",
            description = "Paged, newest first; lọc level + ngày (yyyy-MM-dd) + tìm kiếm q (message/module); "
                    + "grouped=true gom dòng trùng thành 1 dòng kèm số đếm (×N) + thời điểm mới nhất.")
    public ApiResponse<PageResponse<SystemLogResponse>> listLogs(
            @RequestParam(required = false) LogLevel level,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean grouped,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return systemLogService.list(level, date, q, grouped, page, size);
    }
}
