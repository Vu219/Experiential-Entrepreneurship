package com.aima.realtime;

import com.aima.config.RealtimeProperties;
import com.aima.dto.realtime.RealtimeMessage;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.RealtimeConnectionRegistry.Connection;
import com.aima.service.Impl.RealtimeConnectionRegistryImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.EmitterCapture;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Registry SSE: giới hạn kết nối, chọn đích, heartbeat/hết hạn và dọn kết nối chết (Bước 1). */
class RealtimeConnectionRegistryTest {

    private static final Instant FAR = Instant.now().plusSeconds(3600);
    private final JsonMapper json = JsonMapper.builder().build();
    private RealtimeConnectionRegistryImpl registry;

    @BeforeEach
    void setUp() {
        // maxPerUser = 2, maxPerInstance = 3; gửi ngay trên luồng gọi để kiểm tra đồng bộ.
        RealtimeProperties props = new RealtimeProperties("local", "test", 20, 30, 2, 3, 50, 500);
        registry = new RealtimeConnectionRegistryImpl(props, Runnable::run, mock(ScheduledExecutorService.class));
    }

    private record Opened(Connection connection, EmitterCapture capture) {
    }

    private Opened open(UUID userId, boolean admin, Instant deadline) throws Exception {
        Connection connection = registry.register(userId, admin, deadline);
        return new Opened(connection, EmitterCapture.attach(connection.emitter()));
    }

    private RealtimeMessage message(UUID userId, String role, String event) {
        return RealtimeMessage.builder().userId(userId).role(role).event(event)
                .data(json.createObjectNode().put("v", 1)).build();
    }

    @Test
    void beyondMaxPerUser_oldestConnectionIsReplaced() throws Exception {
        UUID user = UUID.randomUUID();
        Opened first = open(user, false, FAR);
        open(user, false, FAR);
        open(user, false, FAR);

        assertTrue(first.capture().text().contains("event:replaced"), first.capture().text());
        assertTrue(first.capture().completed());
        assertEquals(2, registry.connectionCount());
    }

    @Test
    void beyondMaxPerInstance_rejectedWithCapacityError() throws Exception {
        for (int i = 0; i < 3; i++) open(UUID.randomUUID(), false, FAR);

        AppException e = assertThrows(AppException.class, () -> registry.register(UUID.randomUUID(), false, FAR));
        assertEquals(ErrorCode.REALTIME_CAPACITY_EXCEEDED, e.getErrorCode());
    }

    @Test
    void deliver_reachesOnlyTargetUserOrAdmins() throws Exception {
        UUID alice = UUID.randomUUID();
        Opened aliceConn = open(alice, false, FAR);
        Opened bobConn = open(UUID.randomUUID(), false, FAR);
        Opened adminConn = open(UUID.randomUUID(), true, FAR);

        registry.deliver(message(alice, null, "notification.created"));
        registry.deliver(message(null, RealtimeMessage.ROLE_ADMIN, "job.updated"));

        assertTrue(aliceConn.capture().text().contains("event:notification.created"));
        assertFalse(aliceConn.capture().text().contains("job.updated"));
        assertEquals("", bobConn.capture().text());
        assertTrue(adminConn.capture().text().contains("event:job.updated"));
        assertFalse(adminConn.capture().text().contains("notification.created"));
    }

    @Test
    void controlMessages_neverReachBrowsers() throws Exception {
        UUID user = UUID.randomUUID();
        Opened conn = open(user, false, FAR);
        RealtimeMessage control = message(user, null, "job.cancel");
        control.setControl(true);

        registry.deliver(control);

        assertEquals("", conn.capture().text());
    }

    @Test
    void sessionRevoked_isSentThenConnectionClosed() throws Exception {
        UUID user = UUID.randomUUID();
        Opened conn = open(user, false, FAR);

        registry.deliver(message(user, null, "session.revoked"));

        assertTrue(conn.capture().text().contains("event:session.revoked"));
        assertTrue(conn.capture().completed());
        assertEquals(0, registry.connectionCount());
    }

    @Test
    void heartbeat_sendsCommentAndClosesExpiredConnectionsWithReconnect() throws Exception {
        Opened alive = open(UUID.randomUUID(), false, FAR);
        Opened tokenExpired = open(UUID.randomUUID(), false, Instant.now().minusSeconds(1));

        registry.heartbeat();

        assertTrue(alive.capture().text().contains(":hb"), alive.capture().text());
        assertFalse(alive.capture().completed());
        assertTrue(tokenExpired.capture().text().contains("event:reconnect"));
        assertTrue(tokenExpired.capture().text().contains("\"reason\":\"token\""));
        assertTrue(tokenExpired.capture().completed());
        assertEquals(1, registry.connectionCount());
    }

    @Test
    void connectionWithoutTokenDeadline_isCappedByMaxAgeNotClosedEarly() throws Exception {
        Opened conn = open(UUID.randomUUID(), false, null);

        registry.heartbeat();

        assertFalse(conn.capture().completed());
        assertTrue(conn.capture().text().contains(":hb"));
    }

    @Test
    void failedWrite_removesConnection() throws Exception {
        UUID user = UUID.randomUUID();
        Opened conn = open(user, false, FAR);
        conn.capture().failNextWrite();

        registry.deliver(message(user, null, "notification.created"));

        assertEquals(0, registry.connectionCount());
    }

    @Test
    void clientDisconnectOnHeartbeat_onlyRemovesConnection_neverCompletesWithError() throws Exception {
        UUID user = UUID.randomUUID();
        Opened gone = open(user, false, FAR);
        Opened alive = open(user, false, FAR);
        gone.capture().failNextWrite();

        registry.heartbeat();
        registry.deliver(message(user, null, "notification.created"));

        // completeWithError trên response SSE đã commit = dispatch lỗi vào GlobalExceptionHandler (log ERROR + 500 hỏng).
        assertFalse(gone.capture().completedWithError());
        assertEquals(1, registry.connectionCount());
        assertTrue(alive.capture().text().contains("event:notification.created"));
    }

    @Test
    void eventsKeepTheirOrderAndId() throws Exception {
        UUID user = UUID.randomUUID();
        Opened conn = open(user, false, FAR);

        conn.connection().send("ai.delta", null, "{\"seq\":1}");
        conn.connection().send("notification.created", "abc", "{\"seq\":2}");

        String text = conn.capture().text();
        assertTrue(text.indexOf("\"seq\":1") < text.indexOf("\"seq\":2"));
        assertTrue(text.contains("id:abc"));
    }
}
