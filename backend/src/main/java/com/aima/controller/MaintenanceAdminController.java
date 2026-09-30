package com.aima.controller;

import com.aima.dto.request.ContentStatusRepairRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentStatusRepairReport;
import com.aima.dto.response.ContentStatusRepairResult;
import com.aima.service.ContentStatusRepairService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/maintenance")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin · Maintenance", description = "Job sửa dữ liệu một lần, chạy tường minh (ADMIN).")
public class MaintenanceAdminController {

    ContentStatusRepairService repairService;

    @GetMapping("/content-status-repair")
    @Operation(summary = "Dry-run the content status repair (writes nothing)",
            description = "Items whose stored aggregate status differs from the resolver, unpublished Instagram schedules "
                    + "to hold (UNSUPPORTED_MEDIA), unclassified legacy holds, review-unknown items and enum value counts. "
                    + "Ids and statuses only — no content, no tokens. Returns the planToken required to apply.")
    public ApiResponse<ContentStatusRepairReport> dryRun() {
        return repairService.dryRun();
    }

    @PostMapping("/content-status-repair")
    @Operation(summary = "Apply exactly the reviewed dry-run plan",
            description = "Rejected (2144) when data changed since the dry-run. Uses the same resolver as runtime, in "
                    + "batches with item locks; running it again finds nothing to change. Never runs on boot.")
    public ApiResponse<ContentStatusRepairResult> apply(@Valid @RequestBody ContentStatusRepairRequest request) {
        return repairService.apply(request);
    }
}
