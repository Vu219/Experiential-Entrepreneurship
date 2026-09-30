package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.UUID;

/** Cảnh báo không chặn: một lịch khác cùng tài khoản nằm trong cửa sổ trùng lịch của user. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ScheduleWarning", description = "Non-blocking warning (CONFLICT: another schedule on the same account is too close).")
public class ScheduleWarning {
    String type;
    UUID scheduleId;
    Instant scheduledTime;
}
