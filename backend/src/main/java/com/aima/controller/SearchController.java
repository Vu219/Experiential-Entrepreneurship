package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.GlobalSearchResponse;
import com.aima.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Ô tìm kiếm toàn cục trên header (Command Palette) — nhóm "Dữ liệu" của palette gọi endpoint này (debounce phía FE). */
@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Search", description = "Global search box: the caller's own content, strategies and schedules.")
public class SearchController {

    SearchService searchService;

    @GetMapping
    @Operation(summary = "Search the caller's content, strategies and schedules",
            description = "Accent-insensitive (Vietnamese, đ = d), case-insensitive substring match. Content: caption, "
                    + "script hook and hashtags of live platform versions. Strategies: name. Schedules (not cancelled): "
                    + "the scheduled post's text or the target account name. Each group returns at most `limit` items "
                    + "(1–10, default 5) plus its total. q: 1–100 characters (2199); limit out of range: 2200.")
    public ApiResponse<GlobalSearchResponse> search(@AuthenticationPrincipal UserDetails principal,
                                                    @RequestParam(required = false) String q,
                                                    @RequestParam(defaultValue = "5") int limit) {
        return searchService.search(principal.getUsername(), q, limit);
    }
}
