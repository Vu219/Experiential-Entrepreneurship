package com.aima.service.Impl;

import com.aima.entity.ActivityLog;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.mapper.ActivityLogMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.ActivityLogWriter;
import com.aima.service.SystemLogService;
import tools.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi {@code activity_logs} trên {@code activityLogExecutor} — request nghiệp vụ không phải
 * chờ. Bean RIÊNG so với {@code ActivityLogServiceImpl} để proxy {@code @Async} có tác dụng
 * (rule #28).
 *
 * <p><b>Mọi lỗi đều bị nuốt</b> và chuyển sang {@link SystemLogService#error} — ghi log hỏng
 * (DB down, JSON lạ) không được phép làm hỏng nghiệp vụ, và cũng không được im lặng biến mất.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ActivityLogWriterImpl implements ActivityLogWriter {

    static final String LOG_MODULE = "activity.log";

    /** Trần kích thước metadata (ký tự) — chặn một payload bất thường thổi phồng bảng. */
    static final int MAX_METADATA_LENGTH = 4096;

    /** Hậu tố đánh dấu metadata đã bị cắt, để người đọc không tưởng JSON hỏng. */
    static final String TRUNCATED_MARK = "…(đã cắt)";

    ActivityLogRepository activityLogRepository;
    ActivityLogMapper activityLogMapper;
    UserRepository userRepository;
    SystemLogService systemLogService;
    ObjectMapper objectMapper;

    /**
     * Cửa sổ chống trùng (giây): cùng userId + action + targetId trong khoảng này chỉ ghi 1 lần.
     * 0 = tắt dedup.
     */
    @NonFinal
    @Value("${aima.logging.activity-dedup-seconds:60}")
    int dedupSeconds;

    /**
     * Trần số dòng/giờ cho MỖI IP với các action được miễn dedup (LOGIN_FAILED). Vượt trần thì
     * ghi 1 dòng tổng hợp rồi im lặng tới hết giờ. 0 = tắt trần (ghi mọi lần).
     */
    @NonFinal
    @Value("${aima.logging.activity-ip-hourly-cap:100}")
    int ipHourlyCap;

    @Override
    @Async("activityLogExecutor")
    @Transactional
    public void write(ActivityLogService.Entry entry, String ip, String userAgent) {
        try {
            UUID userId = resolveUserId(entry);
            if (isDuplicate(userId, entry)) {
                return;
            }
            Map<String, Object> metadata = entry.metadata();
            long recentFromIp = countRecentFromIp(entry.action(), ip);
            if (recentFromIp >= ipHourlyCap) {
                // Đã ghi dòng tổng hợp ở lần chạm trần → từ đây im lặng tới hết cửa sổ 1 giờ.
                if (recentFromIp > ipHourlyCap) {
                    return;
                }
                // Đúng lúc CHẠM trần: ghi ĐÚNG MỘT dòng tổng hợp để người điều tra biết có flood
                // và biết log bị cắt từ mốc nào. Dòng này cũng mang cùng action+ip nên lần đếm
                // sau sẽ > trần → không bao giờ ghi lần hai trong cùng giờ.
                metadata = Map.of("floodSuppressed", true, "ipHourlyCap", ipHourlyCap,
                        "note", "Đạt trần ghi log cho IP này trong 1 giờ — các lần sau không ghi từng dòng");
            }
            ActivityLog activityLog = activityLogMapper.toLog(
                    userId,
                    entry.userEmail(),
                    entry.action(),
                    entry.targetType(),
                    entry.targetId(),
                    entry.result() == null ? ActivityResult.SUCCESS : entry.result(),
                    ip,
                    userAgent,
                    serializeMetadata(metadata));
            activityLogRepository.save(activityLog);
        } catch (Exception e) {
            // Best-effort: không ném ra ngoài (thread nền, không ai bắt) nhưng phải để lại vết.
            log.error("[ActivityLog] Không ghi được hành động {}: {}", entry.action(), e.getMessage(), e);
            systemLogService.error(LOG_MODULE,
                    "Không ghi được activity log: action=" + entry.action() + ", userId=" + entry.userId(), e);
        }
    }

    /**
     * Nhiều call site chỉ cầm email của người thao tác (vd {@code principal.getUsername()}) chứ
     * không có UUID. Tra ở ĐÂY — thread nền — để request nghiệp vụ không phải trả thêm một query.
     * Không tìm thấy (user đã xoá) thì giữ null: {@code userEmailSnapshot} vẫn đủ để đọc log.
     */
    private UUID resolveUserId(ActivityLogService.Entry entry) {
        if (entry.userId() != null || entry.userEmail() == null) {
            return entry.userId();
        }
        return userRepository.findByEmail(entry.userEmail())
                .map(User::getId)
                .orElse(null);
    }

    /**
     * Số dòng CÙNG action từ CÙNG IP trong 1 giờ qua; trả -1 khi không áp trần (action không nằm
     * trong nhóm miễn dedup, chưa bật trần, hoặc không biết IP — job nền không có request context).
     *
     * <p>Chỉ áp cho nhóm {@link ActivityAction#DEDUP_EXEMPT}: các action đó cố tình bỏ chống trùng
     * nên cần một van an toàn khác để một nguồn dội request không thổi phồng bảng.
     */
    private long countRecentFromIp(ActivityAction action, String ip) {
        if (ipHourlyCap <= 0 || ip == null || !ActivityAction.DEDUP_EXEMPT.contains(action)) {
            return -1;
        }
        return activityLogRepository.countByActionAndIpSince(
                action.name(), ip, LocalDateTime.now().minusHours(1));
    }

    /**
     * Chống spam: cùng (userId, action, targetId) trong cửa sổ dedup thì BỎ QUA bản ghi sau.
     * Hành động hệ thống (userId null) không dedup — không có chủ thể để gom theo, và số lượng
     * vốn nhỏ. Nhóm {@link ActivityAction#DEDUP_EXEMPT} được MIỄN hoàn toàn (xem javadoc ở enum).
     */
    private boolean isDuplicate(UUID userId, ActivityLogService.Entry entry) {
        if (dedupSeconds <= 0 || userId == null || ActivityAction.DEDUP_EXEMPT.contains(entry.action())) {
            return false;
        }
        LocalDateTime since = LocalDateTime.now().minusSeconds(dedupSeconds);
        return activityLogRepository.existsRecentDuplicate(
                userId, entry.action().name(), entry.targetId(), since);
    }

    /**
     * Map → JSON, cắt theo trần. Metadata hỏng KHÔNG được làm mất cả dòng log.
     *
     * <p>Dùng {@code tools.jackson} (Jackson 3) chứ KHÔNG phải bean
     * {@code com.fasterxml.jackson.databind.ObjectMapper}: bean Jackson 2 trong app không có
     * module java-time ở runtime, caller lỡ nhét {@code LocalDateTime} vào metadata sẽ ném lỗi
     * và mất sạch phần metadata.
     */
    private String serializeMetadata(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(metadata);
        } catch (Exception e) {
            log.warn("[ActivityLog] Metadata không serialize được, bỏ qua phần metadata: {}", e.getMessage());
            return null;
        }
        return json.length() <= MAX_METADATA_LENGTH
                ? json
                : json.substring(0, MAX_METADATA_LENGTH - TRUNCATED_MARK.length()) + TRUNCATED_MARK;
    }
}
