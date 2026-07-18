package com.aima.service;

import com.aima.dto.request.BillingRateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BillingRateResponse;
import com.aima.enums.AiTaskCode;

import java.util.List;

/**
 * Hệ số quy đổi hạn mức ({@code billing_rates}): token thật → billable_units trừ vào hạn mức
 * gói của khách. Append-only versioning — tạo version mới tự đóng version đang mở cùng scope.
 * KHÁC đơn giá USD nhà cung cấp trên {@code ai_models} (cost_usd — chi phí của mình).
 */
public interface BillingRateService {

    /** GET /admin/usage/rates — toàn bộ lịch sử version, mới nhất trước. */
    ApiResponse<List<BillingRateResponse>> list();

    /** POST /admin/usage/rates — thêm version mới (đóng version đang mở cùng scope nếu có). */
    ApiResponse<BillingRateResponse> create(String actorEmail, BillingRateRequest request);

    /**
     * Quy đổi tổng token của MỘT lần gọi → billable_units, chốt tại thời điểm ghi event
     * (đổi hệ số sau này không làm sai lịch sử). Không có dòng nào khớp → hệ số 1 (= token).
     * Ưu tiên scope cụ thể nhất: (task, model) > (task, *) > (*, model) > (*, *).
     */
    long toBillableUnits(AiTaskCode taskCode, String modelCode, long totalTokens);
}
