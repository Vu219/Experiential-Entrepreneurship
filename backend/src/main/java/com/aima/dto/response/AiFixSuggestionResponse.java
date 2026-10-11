package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Gợi ý AI sửa bài (lưu JSON ở ai_assist_jobs.result): nội dung gốc lúc tạo gợi ý + nội dung gợi ý — FE vẽ diff. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiFixSuggestionResponse {
    String originalCaption;
    List<String> originalHashtags;
    String caption;
    List<String> hashtags;
    List<String> changes;
}
