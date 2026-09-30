package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Kết quả MỘT dòng batch: code 200 + schedule khi thành công, hoặc code/message của ErrorCode khi lỗi. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ScheduleRowResult", description = "Outcome of one batch row.")
public class ScheduleRowResult {
    String clientRowId;
    int code;
    String message;
    @Schema(description = "Created/replayed schedule (with jobId for NOW and conflict warnings); null on error.")
    PostScheduleResponse schedule;
}
