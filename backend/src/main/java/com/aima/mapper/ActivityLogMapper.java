package com.aima.mapper;

import com.aima.dto.response.ActivityLogResponse;
import com.aima.entity.ActivityLog;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.UUID;

@Mapper(componentModel = "spring")
public interface ActivityLogMapper {

    ActivityLog toLog(UUID userId, String userEmailSnapshot, ActivityAction action,
                      String targetType, String targetId, ActivityResult result,
                      String ip, String userAgent, String metadata);

    /**
     * {@code user} = bản ghi users hiện tại (có thể null khi user đã bị xoá) — chỉ dùng để
     * làm giàu tên/avatar cho UI. Email luôn lấy từ SNAPSHOT trên dòng log, không lấy từ
     * {@code user}: log phải phản ánh email tại thời điểm hành động xảy ra.
     */
    // id/createdAt phải chỉ rõ nguồn: cả `log` lẫn `user` đều có hai property này (kế thừa
    // BaseEntity) nên MapStruct không tự chọn được.
    @Mapping(target = "id", source = "log.id")
    @Mapping(target = "createdAt", source = "log.createdAt")
    @Mapping(target = "userId", source = "log.userId")
    @Mapping(target = "userEmail", source = "log.userEmailSnapshot")
    @Mapping(target = "userFullName", source = "user.fullName")
    @Mapping(target = "userAvatarUrl", source = "user.avatarUrl")
    @Mapping(target = "actionGroup", source = "log.action.group")
    ActivityLogResponse toResponse(ActivityLog log, User user);
}
