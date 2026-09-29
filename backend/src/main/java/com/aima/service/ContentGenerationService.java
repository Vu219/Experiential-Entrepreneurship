package com.aima.service;

import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentGenerationJobResponse;

import java.util.UUID;

public interface ContentGenerationService {

    ApiResponse<ContentGenerationJobResponse> startGeneration(String email, ContentGenerationRequest request, String idempotencyKey);

    ApiResponse<ContentGenerationJobResponse> getJob(String email, UUID jobId);
}
