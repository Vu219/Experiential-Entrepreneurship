package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Một vấn đề AI tìm thấy: đoạn trích, lý do, gợi ý viết lại (ngôn ngữ của bài). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyIssueResponse {
    String excerpt;
    String reason;
    String suggestion;
}
