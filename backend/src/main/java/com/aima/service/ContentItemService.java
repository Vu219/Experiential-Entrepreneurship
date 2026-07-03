package com.aima.service;

import com.aima.dto.request.ContentItemStatusRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentItemResponse;

import java.util.UUID;

public interface ContentItemService {

    ApiResponse<ContentItemResponse> getItem(String email, UUID itemId);

    ApiResponse<ContentItemResponse> updateItem(String email, UUID itemId, ContentItemUpdateRequest request);

    ApiResponse<ContentItemResponse> updateStatus(String email, UUID itemId, ContentItemStatusRequest request);
}
