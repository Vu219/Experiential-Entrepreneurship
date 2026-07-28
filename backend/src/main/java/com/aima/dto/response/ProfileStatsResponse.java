package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Hai ô số trên card hồ sơ người dùng (GET /users/me/stats). Cố tình TÁCH khỏi
 * {@code UserStatsResponse} — cái đó là thống kê TOÀN HỆ THỐNG cho admin, còn cái này là số
 * liệu của chính chủ tài khoản.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ProfileStatsResponse", description = "Số liệu tích lũy của chính người dùng đang đăng nhập.")
public class ProfileStatsResponse {

    @Schema(description = "Số bài đã đăng thành công (POSTED) từ trước tới nay.")
    long postsPublished;

    @Schema(description = "Tổng lượt xem, mỗi bài chỉ tính snapshot ở mốc muộn nhất (không cộng trùng các mốc).")
    long totalReach;
}
