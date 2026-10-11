package com.aima.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Kiểm tra chính sách một bản nền tảng trước khi đăng (chỉ cảnh báo). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PolicyCheckRequest {
    @NotNull(message = "CONTENT_VERSION_NOT_FOUND")
    UUID contentVersionId;
}
