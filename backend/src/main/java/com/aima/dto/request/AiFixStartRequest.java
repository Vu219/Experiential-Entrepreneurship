package com.aima.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Bắt đầu AI sửa một bản nền tảng — từ chi tiết bài lỗi (có postId) hoặc từ cảnh báo trước khi đăng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiFixStartRequest {
    @NotNull(message = "CONTENT_VERSION_NOT_FOUND")
    UUID contentVersionId;
    /** Bài lỗi đang sửa; null khi sửa từ cảnh báo chính sách trước khi đăng. */
    UUID postId;
}
