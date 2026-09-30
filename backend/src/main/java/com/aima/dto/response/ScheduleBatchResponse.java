package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ScheduleBatchResponse", description = "Per-row outcome of POST /schedules/batch (rows are independent).")
public class ScheduleBatchResponse {
    List<ScheduleRowResult> rows;
    int succeeded;
    int failed;
}
