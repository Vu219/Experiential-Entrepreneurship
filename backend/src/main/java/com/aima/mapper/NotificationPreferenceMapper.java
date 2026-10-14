package com.aima.mapper;

import com.aima.dto.response.NotificationChannelResponse;
import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.dto.response.UnsubscribeResponse;
import com.aima.entity.UserNotificationPreference;
import com.aima.enums.NotificationCategory;
import com.aima.util.NotificationChannelPolicy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.UUID;

/** Mapper cho cài đặt thông báo (đồng ý email lỗi đăng bài + kênh theo nhóm). */
@Mapper(componentModel = "spring")
public interface NotificationPreferenceMapper {

    @Mapping(target = "channels", expression = "java(toChannelResponses(preference.getChannels()))")
    NotificationPreferenceResponse toResponse(UserNotificationPreference preference, boolean emailAvailable);

    default List<NotificationChannelResponse> toChannelResponses(String channelsJson) {
        return NotificationChannelPolicy.resolve(channelsJson).entrySet().stream()
                .map(e -> toChannelResponse(e.getKey(), e.getValue().inApp(), e.getValue().toast()))
                .toList();
    }

    @Mapping(target = "mandatoryInApp", expression = "java(category.isMandatoryInApp())")
    @Mapping(target = "emailCapable", expression = "java(category.isEmailCapable())")
    @Mapping(target = "adminOnly", expression = "java(category.isAdminOnly())")
    NotificationChannelResponse toChannelResponse(NotificationCategory category, boolean inApp, boolean toast);

    /** Dòng mặc định cho user chưa có (đăng ký sau V14): không nhận email, chưa được hỏi. */
    default UserNotificationPreference toDefault(UUID userId) {
        UserNotificationPreference preference = new UserNotificationPreference();
        preference.setUserId(userId);
        return preference;
    }

    default UnsubscribeResponse toUnsubscribed() {
        return UnsubscribeResponse.builder().unsubscribed(true).build();
    }
}
