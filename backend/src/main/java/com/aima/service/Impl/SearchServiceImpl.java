package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GlobalSearchResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.PostSchedule;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.SearchMapper;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.SearchService;
import com.aima.util.SearchPatterns;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * GET /search — mỗi nhóm một truy vấn native dùng chung mảnh khớp không dấu {@code repository/SearchSql}
 * (cùng logic với {@code GET /content-items?q=}), giới hạn {@code limit} mục + đếm tổng. Chỉ dữ liệu của chính user.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SearchServiceImpl implements SearchService {

    static final int MAX_QUERY_LENGTH = 100;
    static final int MAX_LIMIT = 10;

    UserRepository userRepository;
    ContentItemRepository contentItemRepository;
    ContentStrategyRepository contentStrategyRepository;
    PostScheduleRepository postScheduleRepository;
    SearchMapper searchMapper;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<GlobalSearchResponse> search(String email, String q, int limit) {
        String keyword = q == null ? "" : q.trim();
        if (keyword.isEmpty() || keyword.length() > MAX_QUERY_LENGTH) {
            throw new AppException(ErrorCode.SEARCH_QUERY_INVALID);
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new AppException(ErrorCode.SEARCH_LIMIT_INVALID);
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        String pattern = SearchPatterns.contains(keyword);
        Pageable top = PageRequest.of(0, limit);
        Page<ContentItem> contents = contentItemRepository.searchText(user.getId(), pattern, top);
        Page<ContentStrategy> strategies = contentStrategyRepository.searchName(user.getId(), pattern, top);
        Page<PostSchedule> schedules = postScheduleRepository.searchText(user.getId(), pattern, top);

        GlobalSearchResponse response = searchMapper.toResponse(contents, strategies, schedules);
        return ApiResponse.success("Tìm kiếm thành công", response);
    }
}
