package com.aima.mapper;

import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.dto.response.UnsubscribeResponse;
import com.aima.entity.UserNotificationPreference;
import org.mapstruct.Mapper;

import java.util.UUID;

/** Mapper cho đồng ý nhận email lỗi đăng bài. */
@Mapper(componentModel = "spring")
public interface NotificationPreferenceMapper {

    NotificationPreferenceResponse toResponse(UserNotificationPreference preference, boolean emailAvailable);

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
