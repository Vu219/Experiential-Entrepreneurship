package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/** Kết quả thao tác hàng loạt — dòng lỗi không làm hỏng dòng khác (mẫu /schedules/batch). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostBulkResponse", description = "Per-post results of a bulk action on failed posts.")
public class FailedPostBulkResponse {

    int succeeded;

    int failed;

    List<Row> results;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Row {
        UUID postId;

        @Schema(description = "200 = success, otherwise the ErrorCode code of the failure.")
        int code;

        String message;

        @Schema(description = "New posting job for a successful RETRY.")
        UUID jobId;
    }
}
