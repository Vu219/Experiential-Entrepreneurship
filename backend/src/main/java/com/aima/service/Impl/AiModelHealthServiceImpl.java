package com.aima.service.Impl;

import com.aima.dto.ai.LlmAttemptPayload;
import com.aima.dto.ai.LlmConfigPayload;
import com.aima.dto.ai.LlmSpecPayload;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.enums.AiProviderCode;
import com.aima.mapper.AiConfigMapper;
import com.aima.repository.AiProviderRepository;
import com.aima.service.AiModelHealthService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Redis: mỗi model đang nghỉ = một key {@code ai:model-health:{provider}:{model}} chứa JSON
 * {@link Entry}, TTL = tới {@code until} (hết TTL = tự hồi, không cần job dọn).
 *
 * <p>Fail-open: mọi thao tác Redis bọc trong {@link #guarded}; lỗi → log WARNING, trả giá trị
 * "mọi model khả dụng", và bỏ qua Redis {@link #REDIS_BACKOFF} để không cộng thêm timeout kết nối
 * vào mỗi lần tạo nội dung khi Redis sập. Riêng thao tác admin ({@link #reset}) báo lỗi rõ.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AiModelHealthServiceImpl implements AiModelHealthService {

    static final String KEY_PREFIX = "ai:model-health:";
    static final Duration REDIS_BACKOFF = Duration.ofSeconds(30);
    static final String OUTCOME_OK = "ok";
    static final String OUTCOME_DAILY_QUOTA = "daily_quota_exhausted";

    StringRedisTemplate redis;
    ObjectMapper objectMapper;
    AiConfigMapper aiConfigMapper;
    AiProviderRepository providerRepository;

    /** Epoch ms tới khi nào bỏ qua Redis sau một lần lỗi (circuit của chính Redis). */
    @NonFinal
    volatile long redisSkipUntilMs;

    @Override
    public void record(List<LlmAttemptPayload> attempts) {
        if (attempts == null || attempts.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        markFreeTier(attempts);
        guarded("record", () -> {
            for (LlmAttemptPayload a : attempts) {
                if (a.getProvider() == null || a.getModel() == null || a.getOutcome() == null) {
                    continue;
                }
                String key = key(a.getProvider(), a.getModel());
                if (OUTCOME_OK.equals(a.getOutcome())) {
                    redis.delete(key); // model vừa trả lời được → hết nghỉ
                } else if (a.getCooldownUntil() != null && a.getCooldownUntil().isAfter(now)) {
                    Entry entry = new Entry(a.getProvider(), a.getModel(),
                            OUTCOME_DAILY_QUOTA.equals(a.getOutcome()) ? STATE_EXHAUSTED : STATE_COOLDOWN,
                            a.getOutcome(), toLocal(a.getCooldownUntil()), Boolean.TRUE.equals(a.getFreeTier()),
                            toLocal(now));
                    redis.opsForValue().set(key, objectMapper.writeValueAsString(entry),
                            Duration.between(now, a.getCooldownUntil()));
                    log.info("[AiModelHealth] {}/{} {} tới {} ({})", a.getProvider(), a.getModel(),
                            entry.state(), entry.until(), a.getOutcome());
                }
            }
            return null;
        }, null);
    }

    /**
     * Cờ "đang dùng gói miễn phí" lưu DB trên provider (không phải Redis — phải sống qua TTL và
     * restart, chỉ admin reset mới xoá). Best-effort: lỗi DB không được làm hỏng luồng gọi AI.
     */
    private void markFreeTier(List<LlmAttemptPayload> attempts) {
        attempts.stream()
                .filter(a -> Boolean.TRUE.equals(a.getFreeTier()) && a.getProvider() != null)
                .map(a -> a.getProvider().toUpperCase(java.util.Locale.ROOT))
                .distinct()
                .forEach(provider -> {
                    try {
                        if (providerRepository.markFreeTierDetected(AiProviderCode.valueOf(provider), LocalDateTime.now()) > 0) {
                            log.warn("[AiModelHealth] Provider {} đang dùng quota FreeTier — khuyên bật billing", provider);
                        }
                    } catch (Exception e) {
                        log.warn("[AiModelHealth] Không ghi được cờ FreeTier cho {}: {}", provider, e.getMessage());
                    }
                });
    }

    @Override
    public LlmConfigPayload filterAvailable(LlmConfigPayload config) {
        if (config == null || config.getPrimary() == null) {
            return config;
        }
        List<LlmSpecPayload> chain = new ArrayList<>();
        chain.add(config.getPrimary());
        if (config.getFallbacks() != null && !config.getFallbacks().isEmpty()) {
            chain.addAll(config.getFallbacks());
        } else if (config.getFallback() != null) {
            chain.add(config.getFallback()); // payload dựng kiểu cũ (chỉ một dự phòng)
        }
        List<String> states = guarded("filter",
                () -> redis.opsForValue().multiGet(chain.stream().map(s -> key(s.getProvider(), s.getModel())).toList()),
                null);
        if (states == null) {
            return config; // Redis lỗi → fail-open
        }
        List<LlmSpecPayload> available = new ArrayList<>();
        for (int i = 0; i < chain.size(); i++) {
            if (states.get(i) == null) {
                available.add(chain.get(i));
            } else {
                log.info("[AiModelHealth] Bỏ qua {}/{} — đang nghỉ", chain.get(i).getProvider(), chain.get(i).getModel());
            }
        }
        if (available.size() == chain.size()) {
            return config;
        }
        if (available.isEmpty()) {
            // Mọi model đều đang nghỉ: vẫn gửi nguyên chuỗi (cooldown chỉ là ước lượng) — AI service
            // tự phân loại và trả lỗi nhanh nếu quả thật chưa hồi.
            log.warn("[AiModelHealth] Mọi model trong chuỗi đều đang nghỉ — vẫn gửi nguyên chuỗi");
            return config;
        }
        return aiConfigMapper.toLlmConfig(available.get(0), available.subList(1, available.size()));
    }

    @Override
    public List<Entry> list() {
        List<Entry> entries = guarded("list", () -> {
            List<String> keys = scanKeys(KEY_PREFIX + "*");
            List<String> values = keys.isEmpty() ? List.of() : redis.opsForValue().multiGet(keys);
            return values == null ? List.<Entry>of() : values.stream().filter(Objects::nonNull)
                    .map(v -> objectMapper.readValue(v, Entry.class)).toList();
        }, List.of());
        return entries.stream()
                .sorted(Comparator.comparing(Entry::provider).thenComparing(Entry::model))
                .toList();
    }

    @Override
    public int reset(String provider) {
        try {
            List<String> keys = scanKeys(KEY_PREFIX + provider.toLowerCase() + ":*");
            if (!keys.isEmpty()) {
                redis.delete(keys);
            }
            log.info("[AiModelHealth] Admin reset trạng thái {} model của provider {}", keys.size(), provider);
            return keys.size();
        } catch (Exception e) {
            log.warn("[AiModelHealth] Reset trạng thái model lỗi (Redis): {}", e.getMessage());
            throw new AppException(ErrorCode.AI_MODEL_HEALTH_UNAVAILABLE);
        }
    }

    private List<String> scanKeys(String pattern) {
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match(pattern).count(200).build())) {
            cursor.forEachRemaining(keys::add);
        }
        return keys;
    }

    private <T> T guarded(String op, Supplier<T> call, T fallback) {
        if (System.currentTimeMillis() < redisSkipUntilMs) {
            return fallback;
        }
        try {
            return call.get();
        } catch (Exception e) {
            redisSkipUntilMs = System.currentTimeMillis() + REDIS_BACKOFF.toMillis();
            log.warn("[AiModelHealth] Redis lỗi khi {} — fail-open (coi mọi model khả dụng) trong {}s: {}",
                    op, REDIS_BACKOFF.toSeconds(), e.getMessage());
            return fallback;
        }
    }

    static String key(String provider, String model) {
        return KEY_PREFIX + provider.toLowerCase() + ":" + model;
    }

    private static LocalDateTime toLocal(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
}
