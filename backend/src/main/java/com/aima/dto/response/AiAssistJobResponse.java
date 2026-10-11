package com.aima.dto.response;

import com.aima.enums.AiAssistKind;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/** Trạng thái một tác vụ AI hỗ trợ chính sách (FE poll tới khi SUCCESS/FAILED). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiAssistJobResponse {
    UUID id;
    AiAssistKind kind;
    GenerationJobStatus status;
    UUID contentVersionId;
    UUID contentItemId;
    UUID postId;
    Platform platform;
    PublishErrorCode errorCode;
    /** Câu thân thiện khi FAILED (không có chuỗi kỹ thuật). */
    String errorMessage;
    /** Nội dung bản nền tảng đã đổi sau khi tạo gợi ý — gợi ý có thể đã cũ. */
    boolean stale;
    Instant appliedAt;
    AiFixSuggestionResponse fix;
    PolicyAiAssessmentResponse check;
}
