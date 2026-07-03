package com.aima.service;

import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BrandProfileResponse;
import com.aima.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface BrandProfileService {
    ApiResponse<BrandProfileResponse> create(String email, BrandProfileRequest request);
    ApiResponse<PageResponse<BrandProfileResponse>> list(String email, String q, String industry, Pageable pageable);
    ApiResponse<List<String>> listIndustries(String email);
    ApiResponse<BrandProfileResponse> get(String email, UUID id);
    ApiResponse<BrandProfileResponse> update(String email, UUID id, BrandProfileRequest request);
    ApiResponse<Void> delete(String email, UUID id);
}
