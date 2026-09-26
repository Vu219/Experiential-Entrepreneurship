package com.aima.controller;

import com.aima.dto.request.LandingSectionUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.LandingSectionResponse;
import com.aima.service.LandingContentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/landing")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Landing", description = "Quản lý nội dung Landing Page (ADMIN): lưu nháp → xuất bản.")
public class LandingContentAdminController {

    LandingContentService landingContentService;

    @GetMapping
    @Operation(summary = "Mọi section: bản nháp + bản đang hiển thị + cờ chưa xuất bản")
    public ApiResponse<List<LandingSectionResponse>> list() {
        return landingContentService.list();
    }

    @PutMapping("/{key}")
    @Operation(summary = "Lưu nháp một section (landing live chưa đổi cho tới khi xuất bản)")
    public ApiResponse<LandingSectionResponse> saveDraft(@PathVariable String key,
                                                         @Valid @RequestBody LandingSectionUpdateRequest request) {
        return landingContentService.saveDraft(key, request);
    }

    @PostMapping("/{key}/publish")
    @Operation(summary = "Xuất bản bản nháp của một section")
    public ApiResponse<LandingSectionResponse> publish(@PathVariable String key) {
        return landingContentService.publish(key);
    }

    @PostMapping("/publish")
    @Operation(summary = "Xuất bản mọi section đang có thay đổi")
    public ApiResponse<List<LandingSectionResponse>> publishAll() {
        return landingContentService.publishAll();
    }

    @PostMapping("/{key}/discard")
    @Operation(summary = "Hủy bản nháp — đưa về bản đang hiển thị")
    public ApiResponse<LandingSectionResponse> discardDraft(@PathVariable String key) {
        return landingContentService.discardDraft(key);
    }
}
