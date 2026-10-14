package com.aima.notification;

import com.aima.dto.notification.NotificationDraft;
import com.aima.dto.request.NotificationChannelRequest;
import com.aima.dto.request.NotificationPreferenceRequest;
import com.aima.entity.Notification;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.NotificationRefType;
import com.aima.enums.NotificationType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.ErrorCode;
import com.aima.repository.NotificationRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.NotificationRetentionJob;
import com.aima.service.NotificationPreferenceService;
import com.aima.service.NotificationService;
import com.aima.util.NotificationParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bước 2: {@code NotificationService.send} tôn trọng cài đặt kênh, chống trùng, lưu params/ref_type và đẩy SSE sau commit;
 * API danh sách (status/category), đánh dấu đã đọc và xoá phát sự kiện đồng bộ giữa các tab.
 */
@SpringBootTest
class NotificationRealtimeIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private NotificationPreferenceService preferenceService;
    @Autowired private NotificationRetentionJob retentionJob;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private MockMvc mvc;
    private User owner;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "ntf-" + UUID.randomUUID() + "@it.local";
        owner = userRepository.save(User.builder().username(email).email(email).fullName("Ntf IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
    }

    private RequestPostProcessor asOwner() {
        return user(owner.getEmail()).roles("USER");
    }

    private NotificationDraft draft(NotificationType type, String dedupeKey) {
        return NotificationDraft.builder().type(type).title("Tiêu đề").message("Nội dung")
                .refType(NotificationRefType.SCHEDULE).refId(UUID.randomUUID())
                .params(NotificationParams.of("platform", "FACEBOOK", "accountName", "Trang A", "missing", null))
                .dedupeKey(dedupeKey).build();
    }

    private List<Notification> mine() {
        return notificationRepository.findAll().stream().filter(n -> n.getUser().getId().equals(owner.getId())).toList();
    }

    private MockHttpServletResponse openStream() throws Exception {
        return mvc.perform(get("/realtime/stream").header("Accept", "text/event-stream, application/json").with(asOwner()))
                .andExpect(request().asyncStarted()).andReturn().getResponse();
    }

    private static String awaitBody(MockHttpServletResponse response, String expected) throws Exception {
        long until = System.currentTimeMillis() + 3000;
        String body = response.getContentAsString();
        while (!body.contains(expected) && System.currentTimeMillis() < until) {
            Thread.sleep(20);
            body = response.getContentAsString();
        }
        return body;
    }

    private void setChannels(Map<String, NotificationChannelRequest> channels) {
        preferenceService.update(owner.getEmail(), NotificationPreferenceRequest.builder().channels(channels).build());
    }

    @Test
    void send_storesParamsAndRefType_andPushesCreatedEventWithToastFlag() throws Exception {
        MockHttpServletResponse stream = openStream();

        assertTrue(notificationService.send(owner, draft(NotificationType.POST_PUBLISHED, null)));

        Notification saved = mine().get(0);
        assertEquals(NotificationRefType.SCHEDULE, saved.getRefType());
        assertTrue(saved.getParams().contains("\"accountName\":\"Trang A\""), saved.getParams());
        assertFalse(saved.getParams().contains("missing"), "tham số null bị bỏ");
        String body = awaitBody(stream, "event:notification.created");
        assertTrue(body.contains("id:" + saved.getId()), body);
        assertTrue(body.contains("\"unreadCount\":1"), body);
        assertTrue(body.contains("\"toast\":true"), body);
        assertTrue(body.contains("\"category\":\"PUBLISHING\""), body);
        assertTrue(body.contains("\"refType\":\"SCHEDULE\""), body);
    }

    @Test
    void inAppOff_noRecordNoEvent_butMandatoryAndPlanExpiredStillDelivered() {
        setChannels(Map.of(
                "PUBLISHING", NotificationChannelRequest.builder().inApp(false).build(),
                "BILLING", NotificationChannelRequest.builder().inApp(false).build(),
                "PUBLISH_ISSUES", NotificationChannelRequest.builder().inApp(false).toast(false).build()));

        assertFalse(notificationService.send(owner, draft(NotificationType.POST_PUBLISHED, null)));
        assertFalse(notificationService.send(owner, draft(NotificationType.PAYMENT_SUCCEEDED, null)));
        assertTrue(notificationService.send(owner, draft(NotificationType.POST_FAILED, null)), "nhóm bắt buộc");
        assertTrue(notificationService.send(owner, draft(NotificationType.PLAN_EXPIRED, null)), "PLAN_EXPIRED luôn trong app");

        assertEquals(2, mine().size());
    }

    @Test
    void toastOff_eventStillSentWithToastFalse() throws Exception {
        setChannels(Map.of("AI_CONTENT", NotificationChannelRequest.builder().toast(false).build()));
        MockHttpServletResponse stream = openStream();

        notificationService.send(owner, draft(NotificationType.REVIEW_NEEDED, null));

        String body = awaitBody(stream, "event:notification.created");
        assertTrue(body.contains("\"toast\":false"), body);
    }

    @Test
    void remindersAreOffByDefault() {
        assertFalse(notificationService.send(owner, draft(NotificationType.SCHEDULE_UPCOMING, null)));
        setChannels(Map.of("REMINDERS", NotificationChannelRequest.builder().inApp(true).build()));
        assertTrue(notificationService.send(owner, draft(NotificationType.SCHEDULE_UPCOMING, null)));
    }

    @Test
    void dedupeKey_sendsOnce() {
        String key = "it-dedupe:" + UUID.randomUUID();
        assertTrue(notificationService.send(owner, draft(NotificationType.AI_QUOTA_WARNING, key)));
        assertFalse(notificationService.send(owner, draft(NotificationType.AI_QUOTA_WARNING, key)));
        assertEquals(1, mine().size());
    }

    @Test
    void list_filtersByStatusAndCategory_andRejectsBadStatus() throws Exception {
        notificationService.send(owner, draft(NotificationType.POST_PUBLISHED, null));
        notificationService.send(owner, draft(NotificationType.PAYMENT_SUCCEEDED, null));
        UUID read = mine().stream().filter(n -> n.getType() == NotificationType.POST_PUBLISHED).findFirst().orElseThrow().getId();
        notificationService.markRead(owner.getEmail(), read);

        mvc.perform(get("/notifications").param("status", "unread").with(asOwner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.totalElements").value(1))
                .andExpect(jsonPath("$.result.content[0].type").value("PAYMENT_SUCCEEDED"))
                .andExpect(jsonPath("$.result.content[0].params.platform").value("FACEBOOK"));
        mvc.perform(get("/notifications").param("category", "publishing").with(asOwner()))
                .andExpect(jsonPath("$.result.totalElements").value(1))
                .andExpect(jsonPath("$.result.content[0].category").value("PUBLISHING"));
        mvc.perform(get("/notifications").param("unreadOnly", "true").with(asOwner()))
                .andExpect(jsonPath("$.result.totalElements").value(1));
        mvc.perform(get("/notifications").param("status", "maybe").with(asOwner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCode.NOTIFICATION_FILTER_INVALID.getCode()));
        mvc.perform(get("/notifications").param("category", "MARKETING").with(asOwner()))
                .andExpect(jsonPath("$.code").value(ErrorCode.NOTIFICATION_CATEGORY_INVALID.getCode()));
    }

    @Test
    void markRead_readAll_delete_deleteRead_pushSyncEvents() throws Exception {
        notificationService.send(owner, draft(NotificationType.POST_PUBLISHED, null));
        notificationService.send(owner, draft(NotificationType.REVIEW_NEEDED, null));
        notificationService.send(owner, draft(NotificationType.NEW_INSIGHT, null));
        List<Notification> all = mine();
        MockHttpServletResponse stream = openStream();

        mvc.perform(patch("/notifications/{id}/read", all.get(0).getId()).with(asOwner())).andExpect(status().isOk());
        String body = awaitBody(stream, "event:notification.read");
        assertTrue(body.contains("\"ids\":[\"" + all.get(0).getId() + "\"]") && body.contains("\"unreadCount\":2"), body);

        mvc.perform(delete("/notifications/{id}", all.get(1).getId()).with(asOwner())).andExpect(status().isOk());
        body = awaitBody(stream, "event:notification.deleted");
        assertTrue(body.contains("\"unreadCount\":1"), body);

        mvc.perform(patch("/notifications/read-all").with(asOwner())).andExpect(status().isOk());
        body = awaitBody(stream, "\"all\":true");
        assertTrue(body.contains("\"all\":true,\"unreadCount\":0") || body.contains("\"unreadCount\":0"), body);

        mvc.perform(delete("/notifications").param("read", "true").with(asOwner()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.result").value(2));
        body = awaitBody(stream, "\"read\":true");
        assertTrue(body.contains("\"read\":true"), body);
        mvc.perform(get("/notifications").with(asOwner())).andExpect(jsonPath("$.result.totalElements").value(0));
        mvc.perform(delete("/notifications/{id}", all.get(2).getId()).with(asOwner())).andExpect(status().isNotFound());
    }

    @Test
    void preferences_returnMatrix_andChannelUpdateKeepsEmailConsent() throws Exception {
        preferenceService.update(owner.getEmail(), NotificationPreferenceRequest.builder().emailPublishErrors(true).build());
        setChannels(Map.of("PUBLISHING", NotificationChannelRequest.builder().toast(false).build()));

        var prefs = preferenceService.get(owner.getEmail()).getResult();
        assertTrue(prefs.isEmailPublishErrors(), "đổi kênh không được tắt email đã đồng ý");
        var publishing = prefs.getChannels().stream().filter(c -> c.getCategory().name().equals("PUBLISHING")).findFirst().orElseThrow();
        assertTrue(publishing.isInApp());
        assertFalse(publishing.isToast());
        var issues = prefs.getChannels().stream().filter(c -> c.getCategory().name().equals("PUBLISH_ISSUES")).findFirst().orElseThrow();
        assertTrue(issues.isMandatoryInApp() && issues.isEmailCapable());
    }

    private void age(Notification n, LocalDateTime createdAt, LocalDateTime readAt, LocalDateTime deletedAt) {
        jdbcTemplate.update("update notifications set created_at = ?, read_at = ?, deleted_at = ? where id = ?",
                createdAt, readAt, deletedAt, n.getId());
    }

    @Test
    void retention_hardDeletesOldReadAllAndSoftDeleted() {
        for (int i = 0; i < 4; i++) notificationService.send(owner, draft(NotificationType.POST_PUBLISHED, null));
        List<Notification> all = mine();
        LocalDateTime now = LocalDateTime.now();
        age(all.get(0), now.minusDays(100), now.minusDays(99), null);  // đã đọc, tạo > 90 ngày → xoá
        age(all.get(1), now.minusDays(100), null, null);               // chưa đọc 100 ngày → giữ
        age(all.get(2), now.minusDays(200), null, null);               // > 180 ngày → xoá
        age(all.get(3), now, null, now.minusDays(31));                 // xoá mềm > 30 ngày → xoá

        ((NotificationRetentionJob) AopTestUtils.getTargetObject(retentionJob)).run();

        List<UUID> left = mine().stream().map(Notification::getId).toList();
        assertEquals(List.of(all.get(1).getId()), left);
    }
}
