package com.aima.notification;

import com.aima.enums.NotificationCategory;
import com.aima.enums.NotificationType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.util.NotificationChannelPolicy;
import com.aima.util.NotificationChannelPolicy.Change;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Cài đặt kênh theo nhóm: mặc định, nhóm bắt buộc, gộp thay đổi, khoá lạ (Bước 2). */
class NotificationChannelPolicyTest {

    @Test
    void emptyJson_usesCategoryDefaults_remindersOff() {
        var channels = NotificationChannelPolicy.resolve("{}");
        assertEquals(new NotificationChannelPolicy.Channel(true, true), channels.get(NotificationCategory.PUBLISHING));
        assertEquals(new NotificationChannelPolicy.Channel(false, false), channels.get(NotificationCategory.REMINDERS));
        assertEquals(NotificationCategory.values().length, channels.size());
    }

    @Test
    void mandatoryCategories_stayInAppEvenIfStoredOff() {
        var channels = NotificationChannelPolicy.resolve("{\"PUBLISH_ISSUES\":{\"inApp\":false,\"toast\":false}}");
        assertTrue(channels.get(NotificationCategory.PUBLISH_ISSUES).inApp());
        assertFalse(channels.get(NotificationCategory.PUBLISH_ISSUES).toast(), "toast vẫn tắt được");
    }

    @Test
    void merge_isPartial_caseInsensitive_andCoercesMandatoryInApp() {
        String json = NotificationChannelPolicy.merge("{\"PUBLISHING\":{\"inApp\":true,\"toast\":true}}", Map.of(
                "publishing", new Change(null, false),
                "ACCOUNTS", new Change(false, null),
                "REMINDERS", new Change(true, true)));
        var channels = NotificationChannelPolicy.resolve(json);
        assertEquals(new NotificationChannelPolicy.Channel(true, false), channels.get(NotificationCategory.PUBLISHING));
        assertTrue(channels.get(NotificationCategory.ACCOUNTS).inApp());
        assertEquals(new NotificationChannelPolicy.Channel(true, true), channels.get(NotificationCategory.REMINDERS));
    }

    @Test
    void merge_unknownCategory_isRejected() {
        AppException e = assertThrows(AppException.class,
                () -> NotificationChannelPolicy.merge("{}", Map.of("MARKETING", new Change(true, true))));
        assertEquals(ErrorCode.NOTIFICATION_CATEGORY_INVALID, e.getErrorCode());
    }

    @Test
    void corruptJson_fallsBackToDefaults() {
        assertTrue(NotificationChannelPolicy.of("{not json", NotificationCategory.AI_CONTENT).inApp());
    }

    @Test
    void everyTypeHasACategory_andAlwaysInAppMatchesTheProposal() {
        assertTrue(Arrays.stream(NotificationType.values()).allMatch(t -> t.getCategory() != null));
        assertTrue(NotificationType.POST_FAILED.isAlwaysInApp());
        assertTrue(NotificationType.TOKEN_EXPIRING.isAlwaysInApp());
        assertTrue(NotificationType.PLAN_EXPIRED.isAlwaysInApp(), "BILLING nhưng ★ trong bảng 2.4");
        assertFalse(NotificationType.PLAN_EXPIRING.isAlwaysInApp());
        assertFalse(NotificationType.POST_PUBLISHED.isAlwaysInApp());
    }
}
