package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GlobalSearchResponse;

/** Ô tìm kiếm toàn cục (Command Palette) — tìm KHÔNG DẤU trong nội dung, chiến lược, lịch đăng của chính user. */
public interface SearchService {

    ApiResponse<GlobalSearchResponse> search(String email, String q, int limit);
}
