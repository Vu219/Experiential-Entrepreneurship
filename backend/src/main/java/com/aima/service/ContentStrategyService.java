package com.aima.service;

import com.aima.dto.request.ContentStrategyRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentStrategyResponse;
import com.aima.dto.response.PageResponse;
import com.aima.enums.StrategyStatus;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface ContentStrategyService {
    ApiResponse<ContentStrategyResponse> create(String email, ContentStrategyRequest request);
    ApiResponse<PageResponse<ContentStrategyResponse>> list(String email, UUID brandId, StrategyStatus status, String q, Pageable pageable);
    ApiResponse<ContentStrategyResponse> get(String email, UUID id);
    ApiResponse<ContentStrategyResponse> update(String email, UUID id, ContentStrategyRequest request);
    ApiResponse<ContentStrategyResponse> updateStatus(String email, UUID id, StrategyStatus status);
    ApiResponse<Void> delete(String email, UUID id);
}
