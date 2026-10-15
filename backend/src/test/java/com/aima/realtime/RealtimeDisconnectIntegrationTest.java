package com.aima.realtime;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.core.read.ListAppender;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.Impl.RealtimeConnectionRegistryImpl;
import com.aima.service.JwtService;
import com.aima.service.RefreshTokenService;
import com.aima.service.TokenBlacklistService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Client ngắt luồng SSE giữa chừng (F5, đóng tab, StrictMode) trên Tomcat THẬT: kết nối phải được gỡ khỏi registry
 * và log không được có ERROR / stack trace — trước đây chuỗi AsyncRequestNotUsableException → GlobalExceptionHandler
 * log ERROR + ghi ApiResponse lên text/event-stream (HttpMessageNotWritableException) → error dispatch AccessDenied.
 */
// application.yml của test không đặt hạn access token (= 0 → token hết hạn ngay) — luồng thật cần token còn hạn.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"jwt.access-token-expiration=3600", "server.shutdown=immediate"})
class RealtimeDisconnectIntegrationTest {

    @LocalServerPort private int port;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private JwtService jwtService;
    @Autowired private RealtimeConnectionRegistryImpl registry;

    // Test không có Redis: filter JWT hỏi blacklist / logout-time → mặc định "không bị thu hồi".
    @MockitoBean private TokenBlacklistService tokenBlacklistService;
    @MockitoBean private RefreshTokenService refreshTokenService;

    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final Logger root = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    private String accessToken;

    @BeforeEach
    void setUp() {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "rt-dc-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder().username(email).email(email).fullName("RT DC").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        accessToken = jwtService.generateAccessToken(user);
        logs.start();
        root.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        root.detachAppender(logs);
    }

    @Test
    void clientAbort_removesEmitter_withoutErrorOrAccessDeniedInLog() throws Exception {
        int before = registry.connectionCount();

        for (int i = 0; i < 3; i++) {
            try (Socket socket = new Socket("localhost", port)) {
                openStream(socket);
                assertEquals(before + 1, registry.connectionCount());
                socket.setSoLinger(true, 0); // đóng kiểu RST như trình duyệt huỷ request
            }
            awaitRemoved(before);
        }
        Thread.sleep(500); // để async/error dispatch (nếu có) kịp chạy và ghi log

        List<String> problems = logs.list.stream()
                .filter(e -> e.getLevel().isGreaterOrEqual(Level.WARN) || mentionsAccessDenied(e))
                .map(e -> e.getLevel() + " " + e.getLoggerName() + ": " + e.getFormattedMessage()
                        + (e.getThrowableProxy() == null ? "" : " / " + e.getThrowableProxy().getClassName()))
                .toList();
        assertTrue(problems.isEmpty(), "Ngắt kết nối SSE không được sinh WARN/ERROR: " + problems);
    }

    private void openStream(Socket socket) throws Exception {
        OutputStream out = socket.getOutputStream();
        out.write(("GET /realtime/stream HTTP/1.1\r\nHost: localhost\r\n"
                + "Accept: text/event-stream, application/json\r\n"
                + "Cookie: access_token=" + accessToken + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        out.flush();
        socket.setSoTimeout(5000);
        InputStream in = socket.getInputStream();
        StringBuilder received = new StringBuilder();
        byte[] buf = new byte[1024];
        while (!received.toString().contains("event:ready")) {
            int n;
            try {
                n = in.read(buf);
            } catch (java.net.SocketTimeoutException e) {
                throw new AssertionError("không nhận được ready: " + received, e);
            }
            assertTrue(n > 0, "luồng đóng trước sự kiện ready: " + received);
            received.append(new String(buf, 0, n, StandardCharsets.UTF_8));
        }
        assertTrue(received.toString().startsWith("HTTP/1.1 200"), received.toString());
    }

    /** Socket chết chỉ lộ ra khi server ghi — heartbeat là thứ ghi định kỳ. */
    private void awaitRemoved(int expected) throws InterruptedException {
        long until = System.currentTimeMillis() + 10_000;
        while (registry.connectionCount() != expected && System.currentTimeMillis() < until) {
            registry.heartbeat();
            Thread.sleep(100);
        }
        assertEquals(expected, registry.connectionCount(), "emitter của client đã ngắt phải bị gỡ khỏi registry");
    }

    private static boolean mentionsAccessDenied(ILoggingEvent event) {
        if (event.getFormattedMessage().contains("Access Denied")) return true;
        for (IThrowableProxy t = event.getThrowableProxy(); t != null; t = t.getCause()) {
            if (t.getClassName().endsWith("AuthorizationDeniedException")
                    || String.valueOf(t.getMessage()).contains("already committed")) return true;
        }
        return false;
    }
}
