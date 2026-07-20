package com.aima.logging;

import com.aima.entity.ActivityLog;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.mapper.ActivityLogMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.Impl.ActivityLogWriterImpl;
import com.aima.service.SystemLogService;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Hai quy tắc chống phình dữ liệu của activity log: chống trùng trong cửa sổ 60s và cắt
 * metadata quá dài. Cộng thêm quy tắc "ghi log hỏng không được phá nghiệp vụ".
 */
@ExtendWith(MockitoExtension.class)
class ActivityLogWriterImplTest {

    @Mock ActivityLogRepository activityLogRepository;
    @Mock UserRepository userRepository;
    @Mock SystemLogService systemLogService;

    ActivityLogWriterImpl writer;

    private static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Mapper thật (MapStruct sinh impl) — test cả phần map sang entity, không mock rỗng.
        ActivityLogMapper mapper = new com.aima.mapper.ActivityLogMapperImpl();
        writer = new ActivityLogWriterImpl(activityLogRepository, mapper, userRepository,
                systemLogService, new ObjectMapper());
        setDedupSeconds(60);
        // Mặc định TẮT trần IP để các test cũ chỉ kiểm tra đúng phần dedup; test nào cần thì tự bật.
        setIpHourlyCap(0);
    }

    /** Ngưỡng dedup là field @Value private — test chỉnh qua reflection thay vì nới visibility. */
    private void setDedupSeconds(int seconds) {
        ReflectionTestUtils.setField(writer, "dedupSeconds", seconds);
    }

    private void setIpHourlyCap(int cap) {
        ReflectionTestUtils.setField(writer, "ipHourlyCap", cap);
    }

    private ActivityLogService.Entry entry(Map<String, Object> metadata) {
        return new ActivityLogService.Entry(ActivityAction.CONTENT_UPDATED, USER_ID, "u@aima.vn",
                "ContentItem", "item-1", ActivityResult.SUCCESS, metadata);
    }

    private ActivityLog captureSaved() {
        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(activityLogRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void write_persistsRow_whenNoRecentDuplicate() {
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), anyString(), any()))
                .thenReturn(false);

        writer.write(entry(null), "1.2.3.4", "curl/8");

        ActivityLog saved = captureSaved();
        assertEquals(ActivityAction.CONTENT_UPDATED, saved.getAction());
        assertEquals(USER_ID, saved.getUserId());
        assertEquals("u@aima.vn", saved.getUserEmailSnapshot());
        assertEquals("item-1", saved.getTargetId());
        assertEquals("1.2.3.4", saved.getIp());
        assertNull(saved.getMetadata());
    }

    @Test
    void write_skipsRow_whenDuplicateWithinWindow() {
        when(activityLogRepository.existsRecentDuplicate(eq(USER_ID), eq("CONTENT_UPDATED"), eq("item-1"), any()))
                .thenReturn(true);

        writer.write(entry(null), null, null);

        verify(activityLogRepository, never()).save(any());
    }

    @Test
    void write_ignoresDedup_whenWindowDisabled() {
        setDedupSeconds(0);

        writer.write(entry(null), null, null);

        verify(activityLogRepository, never()).existsRecentDuplicate(any(), anyString(), anyString(), any());
        verify(activityLogRepository).save(any());
    }

    @Test
    void write_doesNotDedup_systemActions() {
        // userId null = hành động hệ thống: không có chủ thể để gom theo.
        ActivityLogService.Entry systemEntry = new ActivityLogService.Entry(
                ActivityAction.POST_PUBLISHED, null, null, null, null, ActivityResult.SUCCESS, null);

        writer.write(systemEntry, null, null);

        verify(activityLogRepository, never()).existsRecentDuplicate(any(), anyString(), any(), any());
        verify(activityLogRepository).save(any());
    }

    @Test
    void write_truncatesOversizedMetadata() {
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), anyString(), any()))
                .thenReturn(false);

        writer.write(entry(Map.of("blob", "x".repeat(10_000))), null, null);

        String metadata = captureSaved().getMetadata();
        assertTrue(metadata.length() <= 4096,
                "metadata phải bị cắt về trần 4KB, thực tế " + metadata.length());
        assertTrue(metadata.length() < 10_000,
                "metadata phải NGẮN HƠN payload gốc");
        assertTrue(metadata.endsWith("(đã cắt)"),
                "metadata bị cắt phải có dấu hiệu nhận biết, không cắt cụt im lặng");
    }

    @Test
    void write_keepsSmallMetadataIntact() {
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), anyString(), any()))
                .thenReturn(false);

        writer.write(entry(Map.of("status", "APPROVED")), null, null);

        assertEquals("{\"status\":\"APPROVED\"}", captureSaved().getMetadata());
    }

    @Test
    void write_resolvesUserIdFromEmail_whenIdMissing() {
        com.aima.entity.User user = new com.aima.entity.User();
        user.setId(USER_ID);
        when(userRepository.findByEmail("u@aima.vn")).thenReturn(Optional.of(user));
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), any(), any()))
                .thenReturn(false);

        ActivityLogService.Entry byEmail = ActivityLogService.Entry.byActor(
                ActivityAction.DATA_EXPORTED, "u@aima.vn", "AiUsage", null, null);
        writer.write(byEmail, null, null);

        assertEquals(USER_ID, captureSaved().getUserId());
    }

    // ===== LOGIN_FAILED: MIỄN dedup (tần suất thử sai là dữ liệu bảo mật) + trần theo IP =====

    private ActivityLogService.Entry loginFailed() {
        return ActivityLogService.Entry.failed(
                ActivityAction.LOGIN_FAILED, null, "attacker@evil.com", "INVALID_CREDENTIALS");
    }

    @Test
    void write_neverDedups_loginFailed_evenWhenIdenticalWithinWindow() {
        // Nếu LOGIN_FAILED bị gộp, brute-force 50 lần/phút chỉ để lại 1 vết → log vô dụng.
        setIpHourlyCap(0);

        writer.write(loginFailed(), "9.9.9.9", "curl/8");

        verify(activityLogRepository, never()).existsRecentDuplicate(any(), anyString(), any(), any());
        verify(activityLogRepository).save(any());
    }

    @Test
    void write_recordsAttemptedEmailAndIp_onLoginFailed() {
        // Điều tra brute-force cần biết ĐÃ THỬ email nào từ IP nào — kể cả khi email không tồn tại.
        setIpHourlyCap(0);

        writer.write(loginFailed(), "9.9.9.9", "curl/8");

        ActivityLog saved = captureSaved();
        assertEquals("attacker@evil.com", saved.getUserEmailSnapshot());
        assertEquals("9.9.9.9", saved.getIp());
        assertEquals(ActivityResult.FAILURE, saved.getResult());
        assertTrue(saved.getMetadata().contains("INVALID_CREDENTIALS"));
    }

    @Test
    void write_persistsLoginFailed_whileUnderIpCap() {
        setIpHourlyCap(100);
        when(activityLogRepository.countByActionAndIpSince(eq("LOGIN_FAILED"), eq("9.9.9.9"), any()))
                .thenReturn(99L);

        writer.write(loginFailed(), "9.9.9.9", "curl/8");

        String metadata = captureSaved().getMetadata();
        assertFalse(metadata != null && metadata.contains("floodSuppressed"),
                "chưa chạm trần thì phải là dòng thường, không phải dòng tổng hợp");
    }

    @Test
    void write_writesOneSummaryRow_whenIpCapReached() {
        setIpHourlyCap(100);
        when(activityLogRepository.countByActionAndIpSince(eq("LOGIN_FAILED"), eq("9.9.9.9"), any()))
                .thenReturn(100L);

        writer.write(loginFailed(), "9.9.9.9", "curl/8");

        String metadata = captureSaved().getMetadata();
        assertTrue(metadata.contains("floodSuppressed"),
                "đúng lúc chạm trần phải ghi 1 dòng tổng hợp để biết log bị cắt từ đâu");
    }

    @Test
    void write_staysSilent_whenIpCapExceeded() {
        setIpHourlyCap(100);
        when(activityLogRepository.countByActionAndIpSince(eq("LOGIN_FAILED"), eq("9.9.9.9"), any()))
                .thenReturn(101L);

        writer.write(loginFailed(), "9.9.9.9", "curl/8");

        // Dòng tổng hợp đã ghi ở lần chạm trần → không ghi lại lần hai trong cùng giờ.
        verify(activityLogRepository, never()).save(any());
    }

    @Test
    void write_skipsIpCap_whenIpUnknown() {
        // Job nền không có request context → không có IP để áp trần; vẫn phải ghi.
        setIpHourlyCap(100);

        writer.write(loginFailed(), null, null);

        verify(activityLogRepository, never()).countByActionAndIpSince(anyString(), any(), any());
        verify(activityLogRepository).save(any());
    }

    @Test
    void write_doesNotApplyIpCap_toOrdinaryActions() {
        // Trần theo IP chỉ dành cho nhóm được miễn dedup, không đụng tới action thường.
        setIpHourlyCap(100);
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), anyString(), any()))
                .thenReturn(false);

        writer.write(entry(null), "9.9.9.9", "curl/8");

        verify(activityLogRepository, never()).countByActionAndIpSince(anyString(), any(), any());
        verify(activityLogRepository).save(any());
    }

    @Test
    void write_swallowsRepositoryFailure_andReportsToSystemLog() {
        when(activityLogRepository.existsRecentDuplicate(any(), anyString(), anyString(), any()))
                .thenReturn(false);
        when(activityLogRepository.save(any())).thenThrow(new RuntimeException("DB down"));

        // Không được ném ra: đây là luồng nền của một request nghiệp vụ đang chạy bình thường.
        assertDoesNotThrow(() -> writer.write(entry(null), null, null));
        verify(systemLogService).error(eq("activity.log"), anyString(), any(Throwable.class));
    }
}
