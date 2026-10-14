package com.aima.realtime;

import com.aima.entity.Notification;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.NotificationType;
import com.aima.enums.RealtimeEventType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.ErrorCode;
import com.aima.mapper.NotificationMapper;
import com.aima.repository.NotificationRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.RealtimeEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** {@code GET /realtime/stream}: mở luồng async, gửi retry + ready, phát bù theo Last-Event-ID, nhận sự kiện từ bus. */
@SpringBootTest
class RealtimeStreamIntegrationTest {

    private static final String ACCEPT = "text/event-stream, application/json";

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationMapper notificationMapper;
    @Autowired private RealtimeEventPublisher publisher;

    private MockMvc mvc;
    private User owner;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "rt-" + UUID.randomUUID() + "@it.local";
        owner = userRepository.save(User.builder().username(email).email(email).fullName("RT IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
    }

    private MockHttpServletResponse openStream(String lastEventId) throws Exception {
        var builder = get("/realtime/stream").header("Accept", ACCEPT).with(user(owner.getEmail()).roles("USER"));
        if (lastEventId != null) builder.header("Last-Event-ID", lastEventId);
        MvcResult result = mvc.perform(builder).andExpect(request().asyncStarted()).andReturn();
        return result.getResponse();
    }

    /** Sự kiện live đi qua pool gửi của registry (bất đồng bộ) — chờ tối đa 3 giây. */
    private static String awaitBody(MockHttpServletResponse response, String expected) throws Exception {
        long until = System.currentTimeMillis() + 3000;
        String body = response.getContentAsString();
        while (!body.contains(expected) && System.currentTimeMillis() < until) {
            Thread.sleep(20);
            body = response.getContentAsString();
        }
        return body;
    }

    private Notification notification(String title) throws InterruptedException {
        Thread.sleep(5); // created_at tăng dần để thứ tự phát bù ổn định
        return notificationRepository.save(notificationMapper.toNotification(owner, NotificationType.POST_PUBLISHED,
                title, null, null));
    }

    @Test
    void stream_sendsRetryThenReadyWithUnreadCount() throws Exception {
        notification("n1");

        MockHttpServletResponse response = openStream(null);

        assertTrue(response.getContentType().startsWith("text/event-stream"), response.getContentType());
        assertTrue(response.getHeader("Cache-Control").contains("no-transform"));
        String body = response.getContentAsString();
        assertTrue(body.startsWith("retry:3000"), body);
        assertTrue(body.contains("event:ready"), body);
        assertTrue(body.contains("\"unreadCount\":1"), body);
        assertTrue(body.contains("\"resync\":false"), body);
    }

    @Test
    void lastEventId_replaysOnlyNewerNotificationsBeforeReady() throws Exception {
        Notification anchor = notification("old");
        Notification n2 = notification("new-1");
        Notification n3 = notification("new-2");

        String body = openStream(anchor.getId().toString()).getContentAsString();

        assertFalse(body.contains("id:" + anchor.getId()), body);
        int i2 = body.indexOf("id:" + n2.getId());
        int i3 = body.indexOf("id:" + n3.getId());
        int ready = body.indexOf("event:ready");
        assertTrue(i2 > 0 && i3 > i2 && ready > i3, body);
        assertTrue(body.contains("\"toast\":false"), "phát bù không bật toast");
    }

    @Test
    void unknownLastEventId_asksClientToResync() throws Exception {
        String body = openStream(UUID.randomUUID().toString()).getContentAsString();

        assertTrue(body.contains("\"resync\":true"), body);
    }

    @Test
    void publishedEvent_reachesOpenStream() throws Exception {
        MockHttpServletResponse response = openStream(null);

        publisher.toUser(owner.getId(), RealtimeEventType.JOB_UPDATED, Map.of("jobId", "j-1", "status", "RUNNING"));

        String body = awaitBody(response, "event:job.updated");
        assertTrue(body.contains("event:job.updated"), body);
        assertTrue(body.contains("\"jobId\":\"j-1\""), body);
        assertTrue(body.contains("\"v\":1"), body);
    }

    @Test
    void sessionRevoked_closesStream() throws Exception {
        MockHttpServletResponse response = openStream(null);

        publisher.revokeSessions(owner.getId());

        assertTrue(awaitBody(response, "event:session.revoked").contains("event:session.revoked"));
    }

    @Test
    void anonymous_getsJson401() throws Exception {
        mvc.perform(get("/realtime/stream").header("Accept", ACCEPT))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(ErrorCode.UNAUTHENTICATED.getCode()));
    }
}
