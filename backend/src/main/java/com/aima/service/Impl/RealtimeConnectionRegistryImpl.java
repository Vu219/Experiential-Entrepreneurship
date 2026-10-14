package com.aima.service.Impl;

import com.aima.config.RealtimeProperties;
import com.aima.dto.realtime.RealtimeMessage;
import com.aima.enums.RealtimeEventType;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.RealtimeConnectionRegistry;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/**
 * Registry kết nối SSE trong bộ nhớ của instance.
 *
 * <p>Mỗi kết nối có hàng gửi riêng, xả TUẦN TỰ trên pool gửi dùng chung → giữ đúng thứ tự sự kiện của một kết nối
 * (vd {@code ai.delta} theo {@code seq}) và luồng listener Redis / worker không bao giờ bị kẹt bởi socket chậm.
 * Heartbeat chạy trên {@link ScheduledExecutorService} riêng (KHÔNG {@code @Scheduled} + ShedLock: phải chạy ở mọi
 * instance).</p>
 */
@Service
@Slf4j
public class RealtimeConnectionRegistryImpl implements RealtimeConnectionRegistry {

    private static final String HEARTBEAT_COMMENT = "hb";

    private final RealtimeProperties properties;
    private final Executor sendExecutor;
    private final ScheduledExecutorService heartbeatScheduler;
    private final Map<UUID, Deque<Conn>> byUser = new ConcurrentHashMap<>();
    private final AtomicInteger total = new AtomicInteger();

    @Autowired
    public RealtimeConnectionRegistryImpl(RealtimeProperties properties) {
        this(properties, new ThreadPoolExecutor(2, 4, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(5000),
                        daemonThreads("sse-send-")),
                Executors.newSingleThreadScheduledExecutor(daemonThreads("sse-heartbeat-")));
        heartbeatScheduler.scheduleWithFixedDelay(this::heartbeat, properties.heartbeatSeconds(),
                properties.heartbeatSeconds(), TimeUnit.SECONDS);
    }

    /** Cho test: executor gửi tuỳ chọn (vd chạy ngay trên luồng gọi), không tự lên lịch heartbeat. */
    public RealtimeConnectionRegistryImpl(RealtimeProperties properties, Executor sendExecutor,
                                          ScheduledExecutorService heartbeatScheduler) {
        this.properties = properties;
        this.sendExecutor = sendExecutor;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @PreDestroy
    void shutdown() {
        heartbeatScheduler.shutdownNow();
        if (sendExecutor instanceof ThreadPoolExecutor pool) pool.shutdown();
    }

    @Override
    public Connection register(UUID userId, boolean admin, Instant deadline) {
        if (total.get() >= properties.maxPerInstance()) {
            throw new AppException(ErrorCode.REALTIME_CAPACITY_EXCEEDED);
        }
        Instant now = Instant.now();
        Instant maxAge = now.plus(Duration.ofMinutes(properties.maxConnectionMinutes()));
        boolean tokenBound = deadline != null && deadline.isBefore(maxAge);
        Instant closeAt = tokenBound ? deadline : maxAge;
        // Timeout của async request chỉ là lưới an toàn — heartbeat đóng kết nối đúng hạn trước đó.
        long timeoutMs = Math.max(Duration.between(now, closeAt).toMillis(), 0) + 60_000;
        Conn conn = new Conn(userId, admin, new SseEmitter(timeoutMs), closeAt, tokenBound);

        List<Conn> evicted = new ArrayList<>();
        byUser.compute(userId, (key, conns) -> {
            Deque<Conn> list = conns == null ? new ConcurrentLinkedDeque<>() : conns;
            list.addLast(conn);
            total.incrementAndGet();
            while (list.size() > properties.maxPerUser()) {
                Conn oldest = list.pollFirst();
                if (oldest == null) break;
                total.decrementAndGet();
                evicted.add(oldest);
            }
            return list;
        });
        evicted.forEach(old -> old.closeWith(RealtimeEventType.REPLACED.getWireName(), "{\"v\":1}"));

        SseEmitter emitter = conn.emitter;
        emitter.onCompletion(() -> remove(conn));
        emitter.onTimeout(() -> {
            remove(conn);
            emitter.complete();
        });
        emitter.onError(e -> remove(conn));
        log.debug("[Realtime] open {} user={} total={}", conn.id, userId, total.get());
        return conn;
    }

    @Override
    public void deliver(RealtimeMessage message) {
        if (message == null || message.getEvent() == null || Boolean.TRUE.equals(message.getControl())) return;
        String json = message.getData() == null ? "{}" : message.getData().toString();
        boolean revoke = RealtimeEventType.SESSION_REVOKED.getWireName().equals(message.getEvent());
        for (Conn conn : targets(message)) {
            if (revoke) conn.closeWith(message.getEvent(), json);
            else conn.send(message.getEvent(), message.getId(), json);
        }
    }

    @Override
    public int connectionCount() {
        return total.get();
    }

    /** Gửi {@code :hb} cho mọi kết nối; kết nối tới hạn nhận {@code reconnect} rồi đóng. Public cho test. */
    public void heartbeat() {
        Instant now = Instant.now();
        for (Deque<Conn> conns : byUser.values()) {
            for (Conn conn : conns) {
                try {
                    if (!now.isBefore(conn.closeAt)) {
                        String reason = conn.tokenBound ? "token" : "max-age";
                        conn.closeWith(RealtimeEventType.RECONNECT.getWireName(),
                                "{\"v\":1,\"reason\":\"" + reason + "\"}");
                    } else {
                        conn.enqueue(() -> SseEmitter.event().comment(HEARTBEAT_COMMENT));
                    }
                } catch (RuntimeException e) {
                    log.warn("[Realtime] heartbeat lỗi kết nối {}: {}", conn.id, e.toString());
                }
            }
        }
    }

    private List<Conn> targets(RealtimeMessage message) {
        if (message.getUserId() != null) {
            Deque<Conn> conns = byUser.get(message.getUserId());
            return conns == null ? List.of() : List.copyOf(conns);
        }
        if (RealtimeMessage.ROLE_ADMIN.equals(message.getRole())) {
            List<Conn> admins = new ArrayList<>();
            byUser.values().forEach(conns -> conns.stream().filter(c -> c.admin).forEach(admins::add));
            return admins;
        }
        return List.of();
    }

    private void remove(Conn conn) {
        conn.closed = true;
        byUser.computeIfPresent(conn.userId, (key, conns) -> {
            if (conns.remove(conn)) total.decrementAndGet();
            return conns.isEmpty() ? null : conns;
        });
    }

    private static java.util.concurrent.ThreadFactory daemonThreads(String prefix) {
        AtomicInteger seq = new AtomicInteger();
        return runnable -> {
            Thread thread = new Thread(runnable, prefix + seq.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        };
    }

    @FunctionalInterface
    private interface Op {
        void apply(SseEmitter emitter) throws IOException;
    }

    private final class Conn implements Connection {
        final UUID id = UUID.randomUUID();
        final UUID userId;
        final boolean admin;
        final SseEmitter emitter;
        final Instant closeAt;
        final boolean tokenBound;
        final Queue<Op> queue = new ConcurrentLinkedQueue<>();
        final AtomicInteger queued = new AtomicInteger();
        final AtomicBoolean draining = new AtomicBoolean();
        volatile boolean closed;
        volatile boolean closing;

        Conn(UUID userId, boolean admin, SseEmitter emitter, Instant closeAt, boolean tokenBound) {
            this.userId = userId;
            this.admin = admin;
            this.emitter = emitter;
            this.closeAt = closeAt;
            this.tokenBound = tokenBound;
        }

        @Override public UUID id() { return id; }
        @Override public UUID userId() { return userId; }
        @Override public SseEmitter emitter() { return emitter; }

        @Override
        public void send(String event, String eventId, String json) {
            enqueue(() -> {
                SseEmitter.SseEventBuilder builder = SseEmitter.event().name(event).data(json);
                return eventId == null ? builder : builder.id(eventId);
            });
        }

        @Override
        public void sendRetry(long millis) {
            enqueue(() -> SseEmitter.event().reconnectTime(millis).comment("open"));
        }

        /** Gửi sự kiện cuối rồi đóng (client tự quyết định nối lại hay dừng theo tên sự kiện). */
        void closeWith(String event, String json) {
            if (closing) return;
            closing = true;
            remove(this);
            closed = false; // vẫn cho xả nốt sự kiện cuối
            queue.add(em -> em.send(SseEmitter.event().name(event).data(json)));
            queue.add(SseEmitter::complete);
            schedule();
        }

        void enqueue(Supplier<SseEmitter.SseEventBuilder> event) {
            if (closed || closing) return;
            if (queued.incrementAndGet() > properties.maxQueuedEvents()) {
                log.warn("[Realtime] kết nối {} đọc quá chậm ({} sự kiện chờ) — đóng để client resync", id, queued.get());
                fail(null);
                return;
            }
            queue.add(em -> {
                queued.decrementAndGet();
                em.send(event.get());
            });
            schedule();
        }

        private void schedule() {
            if (!draining.compareAndSet(false, true)) return;
            try {
                sendExecutor.execute(this::drain);
            } catch (RejectedExecutionException e) {
                draining.set(false);
                log.warn("[Realtime] pool gửi đầy — đóng kết nối {}", id);
                fail(e);
            }
        }

        private void drain() {
            try {
                Op op;
                while (!closed && (op = queue.poll()) != null) {
                    op.apply(emitter);
                }
            } catch (Exception e) {
                // IOException = client đã ngắt; IllegalStateException = emitter đã complete.
                fail(e);
            } finally {
                draining.set(false);
                if (!closed && !queue.isEmpty()) schedule();
            }
        }

        private void fail(Exception e) {
            closed = true;
            queue.clear();
            remove(this);
            try {
                if (e == null) emitter.complete();
                else emitter.completeWithError(e);
            } catch (Exception ignored) {
                // emitter đã đóng
            }
        }
    }
}
