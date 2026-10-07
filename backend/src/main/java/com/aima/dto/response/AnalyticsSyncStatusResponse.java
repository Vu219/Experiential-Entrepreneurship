package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Trạng thái đồng bộ số liệu của user (GET /analytics/sync-status). FE dùng {@code connected} để chọn chế độ
 * "Dữ liệu mẫu" (chưa có kênh đăng nào ACTIVE) hay dữ liệu thật, và danh sách kênh để báo đang đồng bộ / thiếu
 * quyền / cần kết nối lại.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AnalyticsSyncStatusResponse", description = "Trạng thái đồng bộ số liệu của user.")
public class AnalyticsSyncStatusResponse {

    @Schema(description = "Có ít nhất một kênh đăng (Page / IG Business / Threads) đang ACTIVE.", example = "true")
    boolean connected;

    @Schema(description = "Các kênh đăng của user (kể cả cần kết nối lại).")
    List<AnalyticsSyncAccountResponse> accounts;
}
