package com.aima.service;

import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanFeatureRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PlanFeatureResponse;
import com.aima.dto.response.PlanResponse;
import com.aima.dto.response.PlansResponse;

import java.util.UUID;

public interface PlanService {

    /** Landing page: chỉ gói isActive, sắp theo displayOrder (public). */
    ApiResponse<PlansResponse> getPublic();

    /** Admin: mọi gói (kể cả tắt) + toàn bộ dòng bảng so sánh. */
    ApiResponse<PlansResponse> list();

    ApiResponse<PlanResponse> create(PlanCreateRequest request);

    ApiResponse<PlanResponse> update(UUID id, PlanUpdateRequest request);

    ApiResponse<String> delete(UUID id);

    ApiResponse<PlanFeatureResponse> createFeature(PlanFeatureRequest request);

    ApiResponse<PlanFeatureResponse> updateFeature(UUID id, PlanFeatureRequest request);

    ApiResponse<String> deleteFeature(UUID id);
}
