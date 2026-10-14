package com.aima.content;

import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.request.ContentGenerationRequest;
import com.aima.dto.response.ContentGenerationJobResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.GenerationJobStatus;
import com.aima.enums.Platform;
import com.aima.enums.StrategyStatus;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AiStreamCancelledException;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentGenerationJobRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AiServiceClient;
import com.aima.service.AiStreamListener;
import com.aima.service.ContentGenerationService;
import com.aima.service.TokenUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bước 5 (cờ {@code aima.ai.generation-streaming-enabled=true}): worker chuyển delta AI thành {@code ai.delta} realtime,
 * lưu kết quả cuối như cũ; nút Dừng chốt FAILED/CANCELLED_BY_USER, đóng luồng AI, ghi {@code ai_usage.status=CANCELLED}
 * (input thật + output ước lượng) và KHÔNG lưu bản nội dung. AI service giả lập ở mức {@link AiServiceClient}
 * (giao thức NDJSON kiểm ở {@link AiServiceClientStreamTest}).
 */
@SpringBootTest(properties = "aima.ai.generation-streaming-enabled=true")
class GenerationStreamingIntegrationTest {

    @MockitoBean private AiServiceClient aiServiceClient;
    @MockitoBean private TokenUsageService tokenUsageService;

    @Autowired private WebApplicationContext context;
    @Autowired private ContentGenerationService generationService;
    @Autowired private ContentGenerationJobRepository jobRepository;
    @Autowired private ContentVersionRepository versionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private BrandProfileRepository brandProfileRepository;
    @Autowired private ContentStrategyRepository strategyRepository;
    @Autowired private ContentItemRepository itemRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private MockMvc mvc;
    private User owner;
    private ContentStrategy strategy;
    private ContentItem item;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(tokenUsageService.state(any())).thenReturn(new TokenUsageService.QuotaState(0, 1_000_000L, 0));
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = "stream-" + UUID.randomUUID() + "@it.local";
        owner = userRepository.save(User.builder().username(email).email(email).fullName("Stream IT").password("{noop}x")
                .role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        BrandProfile brand = new BrandProfile();
        brand.setUser(owner);
        brand.setBrandName("Brand Stream");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);
        strategy = new ContentStrategy();
        strategy.setBrandProfile(brand);
        strategy.setName("Chiến lược");
        strategy.setFrequencyCount(3);
        strategy.setStatus(StrategyStatus.ACTIVE);
        strategy = strategyRepository.save(strategy);
        item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.DRAFT);
        item = itemRepository.save(item);
    }

    private ContentGenerationJobResponse start() {
        ContentGenerationRequest request = new ContentGenerationRequest();
        request.setStrategyId(strategy.getId());
        request.setContentItemId(item.getId());
        request.setPlatform(Platform.FACEBOOK);
        return generationService.startGeneration(owner.getEmail(), request, UUID.randomUUID().toString()).getResult();
    }

    private MockHttpServletResponse openStream() throws Exception {
        return mvc.perform(get("/realtime/stream").header("Accept", "text/event-stream, application/json")
                        .with(user(owner.getEmail()).roles("USER")))
                .andExpect(request().asyncStarted()).andReturn().getResponse();
    }

    private static <T> T await(Supplier<T> probe, java.util.function.Predicate<T> done) throws InterruptedException {
        long until = System.currentTimeMillis() + 8000;
        T value = probe.get();
        while (!done.test(value) && System.currentTimeMillis() < until) {
            Thread.sleep(50);
            value = probe.get();
        }
        return value;
    }

    private GenerationJobStatus statusOf(UUID jobId) {
        return jobRepository.findById(jobId).orElseThrow().getStatus();
    }

    private List<Map<String, Object>> usageOf(UUID jobId) {
        return jdbcTemplate.queryForList("select status, total_tokens, input_tokens, output_tokens from ai_usage where request_id = ?",
                jobId);
    }

    static GeneratedContentResult result() {
        return JsonMapper.builder().build().readValue(AiServiceClientStreamTest.RESULT, GeneratedContentResult.class);
    }

    @Test
    void streamedDeltasReachTheBrowser_andTheFinalResultIsSavedAsBefore() throws Exception {
        when(aiServiceClient.generateContentStream(any(), any(), any())).thenAnswer(inv -> {
            AiStreamListener listener = inv.getArgument(1);
            listener.onStart("google", "m1", 120L);
            listener.onDelta("caption", "Xin ", false);
            Thread.sleep(150); // > 100ms → lần gộp đầu được đẩy đi
            listener.onDelta("caption", "chào", false);
            return result();
        });
        MockHttpServletResponse stream = openStream();

        UUID jobId = start().getId();

        assertEquals(GenerationJobStatus.SUCCESS, await(() -> statusOf(jobId), s -> s == GenerationJobStatus.SUCCESS));
        String body = await(() -> {
            try { return stream.getContentAsString(); } catch (Exception e) { return ""; }
        }, b -> b.contains("\"status\":\"SUCCESS\""));
        assertTrue(body.contains("event:ai.delta"), body);
        // Hai mẩu cách nhau < 100ms sau khi bắt đầu → được GỘP thành một ai.delta (seq 1) chứa cả "Xin " + "chào".
        assertTrue(body.contains("\"path\":\"caption\"") && body.contains("\"seq\":1") && body.contains("\"append\":\"Xin "), body);
        assertTrue(body.contains("\"stage\":\"GENERATING\""), body);
        assertEquals(1, versionRepository.findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), Platform.FACEBOOK).size());
        List<Map<String, Object>> usage = await(() -> usageOf(jobId), u -> !u.isEmpty());
        assertEquals("SUCCESS", usage.getFirst().get("status"));
    }

    @Test
    void stop_marksCancelledByUser_closesTheStream_billsPartialUsage_andSavesNothing() throws Exception {
        when(aiServiceClient.generateContentStream(any(), any(), any())).thenAnswer(inv -> {
            AiStreamListener listener = inv.getArgument(1);
            Mono<Void> cancel = inv.getArgument(2);
            listener.onStart("google", "m1", 150L);
            listener.onDelta("caption", "Đang viết…", false);
            cancel.block(Duration.ofSeconds(8)); // AI service còn đang sinh — chờ lệnh Dừng
            throw new AiStreamCancelledException(GeneratedContentResult.builder()
                    .inputTokens(150L).outputTokens(4L).tokensUsed(154L).cachedTokens(0L).build());
        });

        UUID jobId = start().getId();
        assertEquals(GenerationJobStatus.RUNNING, await(() -> statusOf(jobId), s -> s == GenerationJobStatus.RUNNING));

        mvc.perform(post("/content-items/jobs/{id}/cancel", jobId).with(user(owner.getEmail()).roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.status").value("FAILED"))
                .andExpect(jsonPath("$.result.errorCode").value("CANCELLED_BY_USER"));

        List<Map<String, Object>> usage = await(() -> usageOf(jobId), u -> !u.isEmpty());
        assertEquals("CANCELLED", usage.getFirst().get("status"));
        assertEquals(154L, ((Number) usage.getFirst().get("total_tokens")).longValue());
        assertEquals(150L, ((Number) usage.getFirst().get("input_tokens")).longValue());
        var job = jobRepository.findById(jobId).orElseThrow();
        assertEquals("CANCELLED_BY_USER", job.getErrorCode(), "worker không ghi đè lý do huỷ");
        assertTrue(versionRepository.findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), Platform.FACEBOOK).isEmpty());

        // Huỷ lần nữa: job đã kết thúc → trả nguyên trạng, không lỗi.
        mvc.perform(post("/content-items/jobs/{id}/cancel", jobId).with(user(owner.getEmail()).roles("USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.result.errorCode").value("CANCELLED_BY_USER"));
    }

    @Test
    void lateResultOfACancelledJob_isDiscarded() throws Exception {
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        when(aiServiceClient.generateContentStream(any(), any(), any())).thenAnswer(inv -> {
            release.await(); // AI trả về SAU khi user đã dừng (lệnh huỷ không kịp đóng luồng)
            return result();
        });
        UUID jobId = start().getId();
        await(() -> statusOf(jobId), s -> s == GenerationJobStatus.RUNNING);
        generationService.cancel(owner.getEmail(), jobId);
        release.countDown();

        Thread.sleep(800);
        var job = jobRepository.findById(jobId).orElseThrow();
        assertEquals(GenerationJobStatus.FAILED, job.getStatus());
        assertEquals("CANCELLED_BY_USER", job.getErrorCode());
        assertTrue(versionRepository.findAllByContentItem_IdAndPlatformNameAndDeletedAtIsNull(item.getId(), Platform.FACEBOOK).isEmpty(),
                "không ghi đè job user đã huỷ");
    }

    @Test
    void cancel_otherUsersJob_isNotFound() throws Exception {
        when(aiServiceClient.generateContentStream(any(), any(), any())).thenAnswer(inv -> result());
        UUID jobId = start().getId();
        mvc.perform(post("/content-items/jobs/{id}/cancel", jobId).with(user("someone-else@it.local").roles("USER")))
                .andExpect(status().is4xxClientError());
    }
}
