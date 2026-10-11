package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Kết quả áp dụng gợi ý AI: bản đã lưu + (khi đăng lại ngay) kết quả thử lại bài lỗi. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiFixApplyResponse {
    UUID contentVersionId;
    UUID contentItemId;
    FailedPostRetryResponse retry;
}
