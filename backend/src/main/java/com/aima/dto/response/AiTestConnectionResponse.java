package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Kết quả "Kiểm tra kết nối" một AI provider (SUCCESS/FAILED — key sai là kết quả, không phải 5xx). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiTestConnectionResponse {

    String status;

    /** Thông điệp lỗi rút gọn khi FAILED (đã redact — không chứa key). */
    String message;

    Long latencyMs;

    LocalDateTime testedAt;
}
