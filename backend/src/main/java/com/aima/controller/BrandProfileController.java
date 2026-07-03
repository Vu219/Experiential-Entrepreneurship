package com.aima.controller;

import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BrandProfileResponse;
import com.aima.dto.response.PageResponse;
import com.aima.service.BrandProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/brand-profiles")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Brand Profiles", description = "Brand profile management.")
public class BrandProfileController {

    BrandProfileService brandProfileService;

    // FR-05: create
    @PostMapping
    @Operation(summary = "Create a brand profile",
            description = "Creates a brand profile owned by the authenticated user (BR-01).")
    public ApiResponse<BrandProfileResponse> create(@AuthenticationPrincipal UserDetails principal,
                                                    @Valid @RequestBody BrandProfileRequest request) {
        return brandProfileService.create(principal.getUsername(), request);
    }

    // FR-07: list (paginated)
    @GetMapping
    @Operation(summary = "List the current user's brand profiles (paginated)",
            description = "Returns non-deleted brand profiles in pages (query params: page, size, sort); "
                    + "optional q (search by brand name) and industry filters. Defaults to 6 newest per page.")
    public ApiResponse<PageResponse<BrandProfileResponse>> list(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String industry,
            @ParameterObject @PageableDefault(size = 6, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return brandProfileService.list(principal.getUsername(), q, industry, pageable);
    }

    // Nguồn cho dropdown lọc ngành hàng (list đã phân trang nên FE không còn thấy toàn bộ ngành).
    @GetMapping("/industries")
    @Operation(summary = "List distinct industries of the current user's brand profiles",
            description = "Returns the distinct industries across the user's non-deleted brand profiles (for the filter dropdown).")
    public ApiResponse<List<String>> listIndustries(@AuthenticationPrincipal UserDetails principal) {
        return brandProfileService.listIndustries(principal.getUsername());
    }

    // FR-07: view one
    @GetMapping("/{id}")
    @Operation(summary = "Get a brand profile by id",
            description = "Returns a single brand profile owned by the authenticated user; 404 if not found.")
    public ApiResponse<BrandProfileResponse> get(@AuthenticationPrincipal UserDetails principal,
                                                 @PathVariable UUID id) {
        return brandProfileService.get(principal.getUsername(), id);
    }

    // FR-06: update
    @PutMapping("/{id}")
    @Operation(summary = "Update a brand profile",
            description = "Updates a brand profile owned by the authenticated user; 404 if not found.")
    public ApiResponse<BrandProfileResponse> update(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable UUID id,
                                                    @Valid @RequestBody BrandProfileRequest request) {
        return brandProfileService.update(principal.getUsername(), id, request);
    }

    // FR-08: delete
    @DeleteMapping("/{id}")
    @Operation(summary = "Soft-delete a brand profile",
            description = "Soft-deletes (marks deletedAt) a brand profile owned by the authenticated user; 404 if not found.")
    public ApiResponse<Void> delete(@AuthenticationPrincipal UserDetails principal, @PathVariable UUID id) {
        return brandProfileService.delete(principal.getUsername(), id);
    }
}
