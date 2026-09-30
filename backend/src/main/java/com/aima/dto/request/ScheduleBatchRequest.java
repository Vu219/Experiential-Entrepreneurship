package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
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
@Schema(name = "ScheduleBatchRequest", description = "Several schedule rows (one per platform/account) in one call.")
public class ScheduleBatchRequest {

    @NotEmpty(message = "SCHEDULE_BATCH_INVALID")
    @Size(max = 20, message = "SCHEDULE_BATCH_INVALID")
    @Valid
    List<ScheduleBatchRowRequest> rows;
}
