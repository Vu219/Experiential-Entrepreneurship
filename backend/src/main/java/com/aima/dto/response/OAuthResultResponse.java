package com.aima.dto.response;

import com.aima.enums.Platform;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** GET /connections/oauth-results/{id} — kết quả lần liên kết gần nhất (lưu Redis 10 phút, chỉ chủ tài khoản đọc). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "OAuthResultResponse")
public class OAuthResultResponse {
    Platform platform;

    @Schema(description = "Số kết nối vừa tạo/cập nhật (gồm kết nối USER gốc của Facebook).", example = "2")
    int connectedCount;

    List<OAuthSkippedChannelResponse> skipped;
}
