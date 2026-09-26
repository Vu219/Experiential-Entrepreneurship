package com.aima.service;

import com.aima.dto.request.LandingSectionUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.LandingSectionResponse;

import java.util.List;
import java.util.Map;

public interface LandingContentService {

    /** Nội dung ĐÃ XUẤT BẢN của mọi section, theo khoá section — cho landing công khai. */
    ApiResponse<Map<String, Object>> getPublic();

    ApiResponse<List<LandingSectionResponse>> list();

    ApiResponse<LandingSectionResponse> saveDraft(String key, LandingSectionUpdateRequest request);

    ApiResponse<LandingSectionResponse> publish(String key);

    ApiResponse<List<LandingSectionResponse>> publishAll();

    ApiResponse<LandingSectionResponse> discardDraft(String key);
}
