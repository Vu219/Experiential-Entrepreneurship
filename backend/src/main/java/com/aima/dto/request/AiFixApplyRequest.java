package com.aima.dto.request;

import com.aima.enums.AiFixApplyAction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Áp dụng gợi ý (người dùng có thể đã sửa lại): caption + hashtag cuối cùng và lưu hay lưu & đăng lại. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiFixApplyRequest {
    @NotBlank(message = "AI_FIX_NOT_READY")
    @Size(max = 63206, message = "CONTENT_VERSION_TEXT_TOO_LONG")
    String caption;
    @Size(max = 60, message = "CONTENT_VERSION_TOO_MANY_HASHTAGS")
    List<String> hashtags;
    @NotNull(message = "AI_FIX_NOT_READY")
    AiFixApplyAction action;
}
