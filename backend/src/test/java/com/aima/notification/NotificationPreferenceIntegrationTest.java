package com.aima.notification;

import com.aima.dto.request.NotificationPreferenceRequest;
import com.aima.dto.response.NotificationPreferenceResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.EmailPromptStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserNotificationPreferenceRepository;
import com.aima.repository.UserRepository;
import com.aima.service.NotificationPreferenceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Email lỗi đăng bài là opt-in; link huỷ nhận công khai (không đăng nhập) chỉ chấp nhận token hợp lệ. */
@SpringBootTest
class NotificationPreferenceIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private NotificationPreferenceService preferenceService;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserNotificationPreferenceRepository preferenceRepository;

    private MockMvc mvc;
    private User user;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "pref-" + UUID.randomUUID() + "@it.local";
        user = userRepository.save(User.builder().username(email).email(email).fullName("Pref IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
    }

    @Test
    void defaultsToNoEmail_notAsked_thenOptInRecordsConsent() {
        NotificationPreferenceResponse fresh = preferenceService.get(user.getEmail()).getResult();
        assertFalse(fresh.isEmailPublishErrors());
        assertEquals(EmailPromptStatus.NOT_ASKED, fresh.getEmailPromptStatus());
        assertNull(fresh.getConsentAt());

        NotificationPreferenceResponse on = preferenceService.update(user.getEmail(),
                NotificationPreferenceRequest.builder().emailPublishErrors(true).build()).getResult();
        assertTrue(on.isEmailPublishErrors());
        assertEquals(EmailPromptStatus.ACCEPTED, on.getEmailPromptStatus());
        assertNotNull(on.getConsentAt());

        NotificationPreferenceResponse off = preferenceService.update(user.getEmail(),
                NotificationPreferenceRequest.builder().emailPublishErrors(false).build()).getResult();
        assertFalse(off.isEmailPublishErrors());
        assertEquals(EmailPromptStatus.DECLINED, off.getEmailPromptStatus(), "đã trả lời → không hỏi lại");
        assertNull(off.getConsentAt());
    }

    @Test
    void unsubscribeLink_worksWithoutLogin_includingOneClickBody() throws Exception {
        preferenceService.update(user.getEmail(), NotificationPreferenceRequest.builder().emailPublishErrors(true).build());
        String token = preferenceService.unsubscribeToken(user.getId());

        mvc.perform(post("/notifications/unsubscribe").param("token", token)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED).content("List-Unsubscribe=One-Click"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.unsubscribed").value(true));
        assertFalse(preferenceRepository.findById(user.getId()).orElseThrow().isEmailPublishErrors());
    }

    @Test
    void tamperedUnsubscribeLink_isRejected_andPreferenceUntouched() throws Exception {
        preferenceService.update(user.getEmail(), NotificationPreferenceRequest.builder().emailPublishErrors(true).build());
        String token = preferenceService.unsubscribeToken(user.getId());
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("AA") ? "BB" : "AA");

        mvc.perform(post("/notifications/unsubscribe").param("token", tampered))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(2196));
        assertTrue(preferenceRepository.findById(user.getId()).orElseThrow().isEmailPublishErrors());
    }
}
