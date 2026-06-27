package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Tổng quan kết nối của người dùng (card "Tổng quan kết nối").
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ConnectionStatsResponse", description = "Tổng quan trạng thái kết nối của người dùng.")
public class ConnectionStatsResponse {
    long total;
    long active;
    long expired;
    long error;
}
