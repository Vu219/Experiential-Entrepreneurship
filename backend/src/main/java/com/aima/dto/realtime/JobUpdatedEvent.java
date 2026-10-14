package com.aima.dto.realtime;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/**
 * Payload SSE {@code job.updated} — tiến độ một tác vụ nền. Stage/progress chỉ có trong sự kiện, KHÔNG lưu DB (không đổi
 * schema / state machine). FE vẫn GET lại job khi nhận trạng thái cuối (sự kiện không mang kết quả đầy đủ).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class JobUpdatedEvent {
    String kind;
    UUID jobId;
    UUID itemId;
    String platform;
    /** PENDING / RUNNING / SUCCESS / FAILED (phiên nghiên cứu: COMPLETED thay SUCCESS). */
    String status;
    /** Mốc trong RUNNING: QUEUED / PREPARING / GENERATING. */
    String stage;
    JobProgress progress;
    String errorCode;
    /** Id kết quả (vd ContentVersion của job tạo nội dung). */
    UUID resultId;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobProgress {
        int done;
        int total;
        String platform;
    }
}
