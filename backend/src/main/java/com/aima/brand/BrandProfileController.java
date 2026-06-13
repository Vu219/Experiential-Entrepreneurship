package com.aima.brand;

import com.aima.brand.dto.BrandProfileRequest;
import com.aima.brand.dto.BrandProfileResponse;
import com.aima.common.ApiResponse;
import com.aima.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/brand-profiles")
@RequiredArgsConstructor
public class BrandProfileController {

    private final BrandProfileService service;

    // FR-05: create
    @PostMapping
    public ApiResponse<BrandProfileResponse> create(@AuthenticationPrincipal User user,
                                                    @Valid @RequestBody BrandProfileRequest request) {
        return ApiResponse.success("Brand profile created", service.create(user, request));
    }

    // FR-07: list
    @GetMapping
    public ApiResponse<List<BrandProfileResponse>> list(@AuthenticationPrincipal User user) {
        return ApiResponse.success(service.list(user.getId()));
    }

    // FR-07: view one
    @GetMapping("/{id}")
    public ApiResponse<BrandProfileResponse> get(@AuthenticationPrincipal User user,
                                                 @PathVariable UUID id) {
        return ApiResponse.success(service.get(user.getId(), id));
    }

    // FR-06: update
    @PutMapping("/{id}")
    public ApiResponse<BrandProfileResponse> update(@AuthenticationPrincipal User user,
                                                    @PathVariable UUID id,
                                                    @Valid @RequestBody BrandProfileRequest request) {
        return ApiResponse.success("Brand profile updated", service.update(user.getId(), id, request));
    }

    // FR-08: delete
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal User user, @PathVariable UUID id) {
        service.delete(user.getId(), id);
        return ApiResponse.<Void>success("Brand profile deleted", null);
    }
}
