package com.aima.service;

import com.aima.dto.request.TrendResearchRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResearchSessionSummaryResponse;

import java.util.List;
import java.util.UUID;

public interface TrendResearchService {

    ApiResponse<TrendResearchSessionResponse> startResearch(String email, TrendResearchRequest request);

    ApiResponse<TrendResearchSessionResponse> getSession(String email, UUID sessionId);

    ApiResponse<List<TrendResearchSessionSummaryResponse>> listSessions(String email);
}
