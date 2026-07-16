package com.aima.controller;

import com.aima.dto.request.AiModelCreateRequest;
import com.aima.dto.request.AiModelUpdateRequest;
import com.aima.dto.request.AiProviderUpdateRequest;
import com.aima.dto.request.AiRoutingUpdateRequest;
import com.aima.dto.response.AiConfigAuditResponse;
import com.aima.dto.response.AiModelResponse;
import com.aima.dto.response.AiProviderResponse;
import com.aima.dto.response.AiRoutingResponse;
import com.aima.dto.response.AiTestConnectionResponse;
import com.aima.dto.response.AiUsageResponse;
import com.aima.dto.response.AiUsageSummaryResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.security.AiConfigAccess;
import com.aima.service.AiConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Quản trị cấu hình AI. Đọc = ADMIN (class-level); mọi endpoint GHI dùng chung MỘT
 * hằng {@link AiConfigAccess#WRITE} — nâng quyền lên SUPER_ADMIN chỉ sửa một dòng đó.
 */
@RestController
@RequestMapping("/admin/ai")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · AI Config", description = "Cấu hình AI theo DB: nhà cung cấp + API key (mã hóa, "
        + "response chỉ trả masked), model, định tuyến theo nghiệp vụ, audit log.")
public class AiConfigAdminController {

    AiConfigService aiConfigService;

    @GetMapping("/providers")
    @Operation(summary = "Danh sách nhà cung cấp AI (API key luôn ở dạng masked)")
    public ApiResponse<List<AiProviderResponse>> listProviders() {
        return aiConfigService.listProviders();
    }

    @PutMapping("/providers/{id}")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Cập nhật provider (tên / API key / bật-tắt) — key write-only, blank = giữ nguyên")
    public ApiResponse<AiProviderResponse> updateProvider(@PathVariable UUID id,
                                                          @Valid @RequestBody AiProviderUpdateRequest request) {
        return aiConfigService.updateProvider(id, request);
    }

    @PostMapping("/providers/{id}/test")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Kiểm tra kết nối provider (1 call model tối thiểu qua AI service)")
    public ApiResponse<AiTestConnectionResponse> testConnection(@PathVariable UUID id) {
        return aiConfigService.testConnection(id);
    }

    @GetMapping("/models")
    @Operation(summary = "Danh sách model AI")
    public ApiResponse<List<AiModelResponse>> listModels() {
        return aiConfigService.listModels();
    }

    @PostMapping("/models")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Thêm model cho một provider")
    public ApiResponse<AiModelResponse> createModel(@Valid @RequestBody AiModelCreateRequest request) {
        return aiConfigService.createModel(request);
    }

    @PutMapping("/models/{id}")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Cập nhật model (tên hiển thị / bật-tắt / đơn giá ước tính)")
    public ApiResponse<AiModelResponse> updateModel(@PathVariable UUID id,
                                                    @Valid @RequestBody AiModelUpdateRequest request) {
        return aiConfigService.updateModel(id, request);
    }

    @DeleteMapping("/models/{id}")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Xóa model (soft delete) — chặn khi đang được routing dùng (mã 2015)")
    public ApiResponse<AiModelResponse> deleteModel(@PathVariable UUID id) {
        return aiConfigService.deleteModel(id);
    }

    @GetMapping("/routing")
    @Operation(summary = "Định tuyến model theo 6 nghiệp vụ AI")
    public ApiResponse<List<AiRoutingResponse>> listRouting() {
        return aiConfigService.listRouting();
    }

    @PutMapping("/routing/{id}")
    @PreAuthorize(AiConfigAccess.WRITE)
    @Operation(summary = "Cập nhật định tuyến một nghiệp vụ (model chính/fallback + temperature/max tokens)")
    public ApiResponse<AiRoutingResponse> updateRouting(@PathVariable UUID id,
                                                        @Valid @RequestBody AiRoutingUpdateRequest request) {
        return aiConfigService.updateRouting(id, request);
    }

    @GetMapping("/audit")
    @Operation(summary = "Audit log thay đổi cấu hình AI (mới nhất trước; snapshot đã mask key)")
    public ApiResponse<PageResponse<AiConfigAuditResponse>> listAudit(@RequestParam(defaultValue = "0") int page,
                                                                      @RequestParam(defaultValue = "20") int size) {
        return aiConfigService.listAudit(page, size);
    }

    @GetMapping("/usage")
    @Operation(summary = "Bản ghi usage AI chi tiết (mới nhất trước; chỉ có khi AI_CONFIG_FROM_DB bật)")
    public ApiResponse<PageResponse<AiUsageResponse>> listUsage(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size) {
        return aiConfigService.listUsage(page, size);
    }

    @GetMapping("/usage/summary")
    @Operation(summary = "Tổng hợp usage theo tháng (YYYY-MM, mặc định tháng hiện tại): tổng + theo nghiệp vụ + theo model")
    public ApiResponse<AiUsageSummaryResponse> getUsageSummary(@RequestParam(required = false) String month) {
        return aiConfigService.getUsageSummary(month);
    }
}
