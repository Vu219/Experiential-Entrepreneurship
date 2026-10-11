package com.aima.util;

import com.aima.entity.UserNotificationPreference;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Email lỗi đăng bài chỉ gửi khi máy chủ BẬT và người dùng ĐÃ đồng ý. */
class EmailConsentPolicyTest {

    private static UserNotificationPreference pref(boolean consent) {
        UserNotificationPreference p = new UserNotificationPreference();
        p.setEmailPublishErrors(consent);
        return p;
    }

    @Test
    void sendsOnlyWhenServerEnabledAndUserConsented() {
        assertTrue(EmailConsentPolicy.shouldSend(true, pref(true), "a@aima.vn"));
        assertFalse(EmailConsentPolicy.shouldSend(false, pref(true), "a@aima.vn"), "máy chủ tắt");
        assertFalse(EmailConsentPolicy.shouldSend(true, pref(false), "a@aima.vn"), "người dùng chưa/không đồng ý");
        assertFalse(EmailConsentPolicy.shouldSend(false, pref(false), "a@aima.vn"));
        assertFalse(EmailConsentPolicy.shouldSend(true, null, "a@aima.vn"), "chưa có dòng = chưa đồng ý");
        assertFalse(EmailConsentPolicy.shouldSend(true, pref(true), null), "không có email");
        assertFalse(EmailConsentPolicy.shouldSend(true, pref(true), " "));
    }

    @Test
    void newPreferenceDefaultsToNoEmailAndNotAsked() {
        UserNotificationPreference fresh = new UserNotificationPreference();
        assertFalse(fresh.isEmailPublishErrors());
        assertEquals(com.aima.enums.EmailPromptStatus.NOT_ASKED, fresh.getEmailPromptStatus());
        assertNull(fresh.getConsentAt());
    }
}
