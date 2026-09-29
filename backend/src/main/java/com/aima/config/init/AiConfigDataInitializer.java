package com.aima.config.init;

import com.aima.config.AiConfigProperties;
import com.aima.entity.AiModel;
import com.aima.entity.AiModelPriceCatalog;
import com.aima.entity.AiProvider;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiTaskRoutingFallback;
import com.aima.enums.AiConfigAction;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import com.aima.repository.AiModelPriceCatalogRepository;
import com.aima.repository.AiModelRepository;
import com.aima.repository.AiProviderRepository;
import com.aima.repository.AiTaskRoutingFallbackRepository;
import com.aima.repository.AiTaskRoutingRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Seed cấu hình AI theo DB (chạy sau {@code PlanDataInitializer}):
 * <ul>
 *   <li>2 provider ANTHROPIC/GOOGLE — key lấy từ env seed (AI_SEED_*_API_KEY, tuỳ chọn,
 *       chỉ áp khi TẠO MỚI row), luôn {@code enabled=false}: không kích hoạt gì cho tới khi
 *       admin dán key + bật qua UI.</li>
 *   <li>1 model mặc định mỗi provider (khớp default của ai/src/config.py).</li>
 *   <li>Routing mặc định cho đủ 6 task: primary = model Anthropic (khớp LLM_PROVIDER=anthropic
 *       mặc định của AI service), chuỗi dự phòng = [model Google], max_tokens 16000 (= LLM_MAX_TOKENS).</li>
 *   <li>Migration chuỗi dự phòng: routing cũ chỉ có {@code fallback_model_id} → thêm dòng
 *       {@code ai_task_routing_fallback} position 0 (idempotent — chỉ routing chưa có dòng nào).</li>
 *   <li>Partial unique index (WHERE deleted_at IS NULL) — JPA không khai báo được.</li>
 * </ul>
 * Idempotent theo từng row. Dùng cách này thay Flyway/Liquibase vì dự án đang dùng
 * {@code ddl-auto: update} (cùng mẫu {@code PlatformDataInitializer}).
 * KHÔNG log key dưới mọi hình thức.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Order(5)
@EnableConfigurationProperties(AiConfigProperties.class)
public class AiConfigDataInitializer implements CommandLineRunner {

    /** max_tokens mặc định cho routing — khớp LLM_MAX_TOKENS của ai/.env.example. */
    static final int DEFAULT_MAX_TOKENS = 16000;

    /** Model mặc định khi env seed không chỉ định — khớp default của ai/src/config.py. */
    static final String DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
    static final String DEFAULT_GOOGLE_MODEL = "gemini-2.5-pro";

    /**
     * Bảng giá GỢI Ý (USD / 1M token in, out) — provider không trả giá qua API nên tự bảo trì;
     * admin sửa giá thực trên từng AiModel. Chỉ áp khi TẠO MỚI row, không ghi đè chỉnh sửa.
     */
    static final Object[][] PRICE_CATALOG_SEED = {
            {AiProviderCode.ANTHROPIC, "claude-opus-4-6", "5", "25"},
            {AiProviderCode.ANTHROPIC, "claude-opus-4-5", "5", "25"},
            {AiProviderCode.ANTHROPIC, "claude-opus-4-1", "15", "75"},
            {AiProviderCode.ANTHROPIC, "claude-sonnet-4-6", "3", "15"},
            {AiProviderCode.ANTHROPIC, "claude-sonnet-4-5", "3", "15"},
            {AiProviderCode.ANTHROPIC, "claude-haiku-4-5", "1", "5"},
            {AiProviderCode.GOOGLE, "gemini-3-pro-preview", "2", "12"},
            {AiProviderCode.GOOGLE, "gemini-2.5-pro", "1.25", "10"},
            {AiProviderCode.GOOGLE, "gemini-2.5-flash", "0.30", "2.50"},
            {AiProviderCode.GOOGLE, "gemini-2.5-flash-lite", "0.10", "0.40"},
    };

    AiProviderRepository providerRepository;
    AiModelRepository modelRepository;
    AiTaskRoutingRepository routingRepository;
    AiTaskRoutingFallbackRepository fallbackRepository;
    AiModelPriceCatalogRepository priceCatalogRepository;
    AiConfigProperties properties;
    JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        AiConfigProperties.Seed seed = properties.seed();

        AiProvider anthropic = seedProvider(AiProviderCode.ANTHROPIC, "Anthropic (Claude)", seed.anthropicApiKey());
        AiProvider google = seedProvider(AiProviderCode.GOOGLE, "Google (Gemini)", seed.googleApiKey());

        AiModel anthropicModel = seedModel(anthropic, defaultIfBlank(seed.anthropicModel(), DEFAULT_ANTHROPIC_MODEL));
        AiModel googleModel = seedModel(google, defaultIfBlank(seed.googleModel(), DEFAULT_GOOGLE_MODEL));

        seedRouting(anthropicModel, googleModel);
        migrateLegacyFallbacks();
        seedPriceCatalog();
        createPartialUniqueIndexes();
        refreshAuditActionCheck();
        widenTestStatusColumn();
    }

    /**
     * Routing có {@code fallback_model_id} (dữ liệu trước chuỗi nhiều model) nhưng chưa có dòng
     * nào ở {@code ai_task_routing_fallback} → chuyển thành position 0. Idempotent: sau lần đầu
     * mọi routing đều đã có dòng (hoặc không có dự phòng) nên không làm gì. Cột legacy được giữ
     * nguyên (luôn = position 0) để rollback backend cũ vẫn chạy.
     */
    private void migrateLegacyFallbacks() {
        for (AiTaskRouting routing : routingRepository.findAllWithModels()) {
            if (routing.getFallbackModel() == null || fallbackRepository.existsByRouting(routing)) {
                continue;
            }
            fallbackRepository.save(AiTaskRoutingFallback.builder()
                    .routing(routing).model(routing.getFallbackModel()).position(0).build());
            log.info("[AiConfigInit] Chuyển fallback {} của routing {} thành chuỗi dự phòng (position 0)",
                    routing.getFallbackModel().getModelCode(), routing.getTaskCode());
        }
    }

    /**
     * {@code last_test_status} tạo với varchar(20) nhưng AiTestStatus mới có giá trị 21 ký tự
     * (DAILY_QUOTA_EXHAUSTED) — {@code ddl-auto: update} không nới độ dài cột. CHECK constraint
     * của cột do PaymentDataInitializer.ENUM_COLUMNS đồng bộ. Idempotent (nới lại cùng kiểu).
     */
    private void widenTestStatusColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE ai_providers ALTER COLUMN last_test_status TYPE varchar(30)");
        } catch (Exception e) {
            log.warn("[AiConfigInit] Nới cột ai_providers.last_test_status bỏ qua: {}", e.getMessage());
        }
    }

    /**
     * Hibernate sinh CHECK constraint cho cột enum lúc TẠO bảng nhưng {@code ddl-auto: update}
     * KHÔNG nới nó khi enum thêm giá trị (vd SYNC_MODELS) → insert audit vỡ constraint.
     * Tái tạo constraint theo enum hiện hành mỗi lần khởi động — idempotent, tự lành cho
     * các giá trị enum thêm sau này.
     */
    private void refreshAuditActionCheck() {
        String values = Arrays.stream(AiConfigAction.values())
                .map(a -> "'" + a.name() + "'")
                .collect(Collectors.joining(","));
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE ai_config_audit DROP CONSTRAINT IF EXISTS ai_config_audit_action_check");
            jdbcTemplate.execute(
                    "ALTER TABLE ai_config_audit ADD CONSTRAINT ai_config_audit_action_check "
                            + "CHECK (action IN (" + values + "))");
            log.info("[AiConfigInit] Check constraint ai_config_audit_action_check đồng bộ theo enum.");
        } catch (Exception e) {
            log.warn("[AiConfigInit] Tái tạo check constraint audit action bỏ qua: {}", e.getMessage());
        }
    }

    private AiProvider seedProvider(AiProviderCode code, String name, String apiKey) {
        return providerRepository.findByCodeAndDeletedAtIsNull(code)
                .orElseGet(() -> {
                    boolean hasKey = apiKey != null && !apiKey.isBlank();
                    AiProvider provider = AiProvider.builder()
                            .code(code)
                            .name(name)
                            .apiKey(hasKey ? apiKey : null)
                            .enabled(false)
                            .build();
                    AiProvider saved = providerRepository.save(provider);
                    log.info("[AiConfigInit] Seeded provider {} (disabled, key: {})",
                            code, hasKey ? "từ env seed" : "chưa có");
                    return saved;
                });
    }

    private AiModel seedModel(AiProvider provider, String modelCode) {
        return modelRepository.findByProviderAndModelCodeAndDeletedAtIsNull(provider, modelCode)
                .orElseGet(() -> {
                    AiModel model = AiModel.builder()
                            .provider(provider)
                            .modelCode(modelCode)
                            .displayName(modelCode)
                            .enabled(true)
                            .build();
                    AiModel saved = modelRepository.save(model);
                    log.info("[AiConfigInit] Seeded model {} ({})", modelCode, provider.getCode());
                    return saved;
                });
    }

    private void seedRouting(AiModel primaryModel, AiModel fallbackModel) {
        for (AiTaskCode task : AiTaskCode.values()) {
            if (routingRepository.findByTaskCodeAndDeletedAtIsNull(task).isPresent()) {
                continue;
            }
            AiTaskRouting routing = AiTaskRouting.builder()
                    .taskCode(task)
                    .primaryModel(primaryModel)
                    .fallbackModel(fallbackModel)
                    .maxTokens(DEFAULT_MAX_TOKENS)
                    .enabled(true)
                    .build();
            routing.getFallbacks().add(AiTaskRoutingFallback.builder()
                    .routing(routing).model(fallbackModel).position(0).build());
            routingRepository.save(routing);
            log.info("[AiConfigInit] Seeded routing {} → {} (fallback {})",
                    task, primaryModel.getModelCode(), fallbackModel.getModelCode());
        }
    }

    private void seedPriceCatalog() {
        for (Object[] row : PRICE_CATALOG_SEED) {
            AiProviderCode providerCode = (AiProviderCode) row[0];
            String modelCode = (String) row[1];
            if (priceCatalogRepository
                    .findByProviderCodeAndModelCodeAndDeletedAtIsNull(providerCode, modelCode)
                    .isPresent()) {
                continue;
            }
            AiModelPriceCatalog entry = AiModelPriceCatalog.builder()
                    .providerCode(providerCode)
                    .modelCode(modelCode)
                    .inputPricePer1m(new BigDecimal((String) row[2]))
                    .outputPricePer1m(new BigDecimal((String) row[3]))
                    .build();
            priceCatalogRepository.save(entry);
            log.info("[AiConfigInit] Seeded price catalog {} ({})", modelCode, providerCode);
        }
    }

    // Unique "còn sống" (bỏ qua row đã soft-delete) — từng index một để một lỗi không chặn các index còn lại.
    private void createPartialUniqueIndexes() {
        String[] statements = {
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_providers_code " +
                        "ON ai_providers (code) WHERE deleted_at IS NULL",
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_models_provider_model " +
                        "ON ai_models (provider_id, model_code) WHERE deleted_at IS NULL",
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_task_routing_task_code " +
                        "ON ai_task_routing (task_code) WHERE deleted_at IS NULL",
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_price_catalog " +
                        "ON ai_model_price_catalog (provider_code, model_code) WHERE deleted_at IS NULL"
        };
        for (String sql : statements) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.warn("[AiConfigInit] Tạo partial unique index bỏ qua: {}", e.getMessage());
            }
        }
        log.info("[AiConfigInit] Partial unique index cho ai_providers/ai_models/ai_task_routing đã sẵn sàng.");
    }

    private static String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
