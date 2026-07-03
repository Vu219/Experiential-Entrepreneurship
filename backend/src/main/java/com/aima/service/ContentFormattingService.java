package com.aima.service;

import com.aima.dto.request.ContentFormatRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentFormattingJobResponse;

import java.util.UUID;

public interface ContentFormattingService {

    ApiResponse<ContentFormattingJobResponse> startFormatting(String email, UUID itemId, ContentFormatRequest request);

    ApiResponse<ContentFormattingJobResponse> getJob(String email, UUID jobId);
}
