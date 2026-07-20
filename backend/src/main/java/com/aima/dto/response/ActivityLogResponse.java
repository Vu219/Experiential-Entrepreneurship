package com.aima.dto.response;

import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityActionGroup;
import com.aima.enums.ActivityResult;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một dòng log hoạt động người dùng (tab /admin/logs?tab=activity).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ActivityLogResponse", description = "Một hành động nghiệp vụ đã ghi nhận.")
public class ActivityLogResponse {

    UUID id;

    LocalDateTime createdAt;

    @Schema(description = "null = hành động hệ thống (job nền), không gắn user.")
    UUID userId;

    @Schema(description = "Email chốt lúc ghi log — còn đọc được sau khi user bị xoá.")
    String userEmail;

    @Schema(description = "Tên hiện tại, tra từ bảng users. null khi user đã bị xoá — FE hiển thị email.")
    String userFullName;

    @Schema(description = "Avatar hiện tại. null khi user đã bị xoá hoặc chưa đặt — FE dùng chữ cái đầu.")
    String userAvatarUrl;

    ActivityAction action;

    @Schema(description = "Nhóm của action — FE gom optgroup trong dropdown lọc.")
    ActivityActionGroup actionGroup;

    String targetType;

    String targetId;

    ActivityResult result;

    String ip;

    String userAgent;

    @Schema(description = "Ngữ cảnh bổ sung dạng chuỗi JSON (đã cắt nếu quá dài).")
    String metadata;
}
