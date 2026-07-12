package com.aima.controller;

import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanFeatureRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlanFeatureResponse;
import com.aima.dto.response.PlanResponse;
import com.aima.dto.response.PlansResponse;
import com.aima.service.PlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/admin/plans")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Plans", description = "Quản lý gói dịch vụ + bảng so sánh (ADMIN). "
        + "3 gói lõi FREE/PLUS/PRO không cho sửa code / xóa.")
public class PlanAdminController {

    PlanService planService;

    @GetMapping
    @Operation(summary = "Danh sách gói (kể cả gói tắt) + bảng so sánh")
    public ApiResponse<PlansResponse> list() {
        return planService.list();
    }

    @PostMapping
    @Operation(summary = "Tạo gói mới (ngoài 3 gói lõi)")
    public ApiResponse<PlanResponse> create(@Valid @RequestBody PlanCreateRequest request) {
        return planService.create(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật gói (tên, giá, tokenQuota, mô tả, thứ tự, highlight, isActive)")
    public ApiResponse<PlanResponse> update(@PathVariable UUID id, @Valid @RequestBody PlanUpdateRequest request) {
        return planService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa gói (soft delete) — gói lõi bị chặn (mã 1983)")
    public ApiResponse<String> delete(@PathVariable UUID id) {
        return planService.delete(id);
    }

    @PostMapping("/features")
    @Operation(summary = "Thêm dòng tính năng vào bảng so sánh")
    public ApiResponse<PlanFeatureResponse> createFeature(@Valid @RequestBody PlanFeatureRequest request) {
        return planService.createFeature(request);
    }

    @PutMapping("/features/{id}")
    @Operation(summary = "Cập nhật dòng tính năng + giá trị từng gói")
    public ApiResponse<PlanFeatureResponse> updateFeature(@PathVariable UUID id,
                                                          @Valid @RequestBody PlanFeatureRequest request) {
        return planService.updateFeature(id, request);
    }

    @DeleteMapping("/features/{id}")
    @Operation(summary = "Xóa dòng tính năng (soft delete)")
    public ApiResponse<String> deleteFeature(@PathVariable UUID id) {
        return planService.deleteFeature(id);
    }
}
