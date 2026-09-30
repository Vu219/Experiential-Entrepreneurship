package com.aima.service;

import com.aima.dto.request.ContentStatusRepairRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentStatusRepairReport;
import com.aima.dto.response.ContentStatusRepairResult;

/**
 * Job MỘT LẦN sửa dữ liệu trạng thái sau Flyway V3/V4 (Phase 6). Chạy tường minh qua endpoint admin —
 * không bao giờ tự chạy khi boot. Mặc định dry-run (không ghi); apply cần planToken của đúng lần dry-run đã xem.
 */
public interface ContentStatusRepairService {

    ApiResponse<ContentStatusRepairReport> dryRun();

    ApiResponse<ContentStatusRepairResult> apply(ContentStatusRepairRequest request);
}
