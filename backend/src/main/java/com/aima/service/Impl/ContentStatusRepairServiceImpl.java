package com.aima.service.Impl;

import com.aima.dto.request.ContentStatusRepairRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentStatusRepairReport;
import com.aima.dto.response.ContentStatusRepairResult;
import com.aima.entity.PostSchedule;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.projection.VersionPublishingState;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.ContentStatusRepairService;
import com.aima.service.ScheduleHoldService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Job sửa dữ liệu một lần (Phase 6, plan §4): tính lại trạng thái tổng bằng CHÍNH ContentItemStatusResolver cho
 * bài mà giá trị lưu lệch với quy tắc (vd bài NEED_REVIEW/APPROVED cũ V3 tạm về GENERATED), và giữ các lịch
 * Instagram chưa đăng bằng UNSUPPORTED_MEDIA. Không tự phê duyệt, không đoán lý do cho hold cũ — hai nhóm đó
 * chỉ báo cáo. Log/response chỉ có id + trạng thái, không nội dung, không token.
 *
 * <p>Dry-run: đọc theo batch (keyset id), không ghi. Apply: tính lại kế hoạch, token phải trùng lần dry-run (dữ
 * liệu đổi sau dry-run → từ chối), áp theo batch — mỗi bài khóa + refresh trong transaction riêng. Chạy lại lần
 * hai: kế hoạch rỗng, không đổi gì.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ContentStatusRepairServiceImpl implements ContentStatusRepairService {

    static final int BATCH = 200;
    static final List<ScheduleStatus> UNPUBLISHED = List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);
    static final EnumSet<ContentItemStatus> IN_PIPELINE = EnumSet.complementOf(EnumSet.copyOf(ContentItemStatus.PRE_PUBLISHING));
    static final Map<String, String> ENUM_COLUMNS = new LinkedHashMap<>();
    static {
        ENUM_COLUMNS.put("content_items.status", "select status v, count(*) c from content_items group by status");
        ENUM_COLUMNS.put("content_items.review_status", "select review_status v, count(*) c from content_items group by review_status");
        ENUM_COLUMNS.put("content_versions.status", "select status v, count(*) c from content_versions group by status");
        ENUM_COLUMNS.put("post_schedules.status", "select status v, count(*) c from post_schedules group by status");
        ENUM_COLUMNS.put("posts.snapshot_state", "select snapshot_state v, count(*) c from posts group by snapshot_state");
    }

    ContentItemRepository itemRepository;
    ContentVersionRepository versionRepository;
    PostScheduleRepository scheduleRepository;
    ContentItemStatusResolver statusResolver;
    ScheduleHoldService holdService;
    ContentItemMapper mapper;
    JdbcTemplate jdbc;
    TransactionTemplate tx;

    private record Plan(List<ContentStatusRepairReport.Change> changes, List<UUID> instagram, String token) {
    }

    @Override
    public ApiResponse<ContentStatusRepairReport> dryRun() {
        Plan plan = plan();
        List<UUID> unclassified = tx.execute(s -> scheduleRepository.findUnclassifiedHoldIds());
        List<UUID> reviewUnknown = tx.execute(s -> itemRepository.findUnreviewedInStatuses(IN_PIPELINE));
        ContentStatusRepairReport report = mapper.toRepairReport(plan.token(), Instant.now(), flywayVersion(),
                plan.changes(), plan.instagram(), unclassified, reviewUnknown, enumUsage());
        log.info("[StatusRepair] Dry-run: {} bài lệch trạng thái, {} lịch IG sẽ tạm giữ, {} hold chưa phân loại, {} bài duyệt không xác định",
                plan.changes().size(), plan.instagram().size(), unclassified.size(), reviewUnknown.size());
        return ApiResponse.success("Dry-run: chưa ghi gì — xem kế hoạch rồi apply bằng planToken", report);
    }

    @Override
    public ApiResponse<ContentStatusRepairResult> apply(ContentStatusRepairRequest request) {
        Plan plan = plan();
        if (!plan.token().equals(request.getPlanToken())) {
            throw new AppException(ErrorCode.REPAIR_PLAN_CHANGED);
        }
        int updated = 0;
        List<UUID> itemIds = plan.changes().stream().map(ContentStatusRepairReport.Change::getItemId).toList();
        for (int i = 0; i < itemIds.size(); i += BATCH) {
            List<UUID> batch = itemIds.subList(i, Math.min(i + BATCH, itemIds.size()));
            // Cùng resolver với runtime: khóa bài (thứ tự id) rồi tính lại từ trạng thái hiện hành.
            tx.executeWithoutResult(s -> statusResolver.refreshAll(batch));
            updated += batch.size();
            batch.forEach(id -> plan.changes().stream().filter(c -> c.getItemId().equals(id)).findFirst()
                    .ifPresent(c -> log.info("[StatusRepair] Bài {}: {} → {} ({})", id, c.getFrom(), c.getTo(), c.getReason())));
        }
        int held = 0;
        for (UUID scheduleId : plan.instagram()) {
            Boolean changed = tx.execute(s -> holdInstagram(scheduleId));
            if (Boolean.TRUE.equals(changed)) {
                held++;
                log.info("[StatusRepair] Lịch IG {} → ON_HOLD (UNSUPPORTED_MEDIA)", scheduleId);
            }
        }
        Plan after = plan();
        ContentStatusRepairResult result = mapper.toRepairResult(updated, held, after.changes().size() + after.instagram().size());
        return ApiResponse.success("Đã áp dụng kế hoạch sửa dữ liệu", result);
    }

    private boolean holdInstagram(UUID scheduleId) {
        UUID itemId = scheduleRepository.findContentItemId(scheduleId).orElse(null);
        if (itemId == null) {
            return false;
        }
        statusResolver.lock(itemId);
        PostSchedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null || !UNPUBLISHED.contains(schedule.getStatus())) {
            return false; // đã đăng/hủy từ lúc dry-run — không đụng
        }
        boolean changed = holdService.hold(schedule, HoldReason.UNSUPPORTED_MEDIA);
        statusResolver.refresh(itemId);
        return changed;
    }

    private Plan plan() {
        List<ContentStatusRepairReport.Change> changes = new ArrayList<>();
        UUID after = new UUID(0L, 0L);
        while (true) {
            UUID cursor = after;
            List<UUID> ids = tx.execute(s -> itemRepository.findActiveIdsAfter(cursor, PageRequest.of(0, BATCH)));
            if (ids.isEmpty()) {
                break;
            }
            tx.executeWithoutResult(s -> {
                for (UUID id : ids) {
                    ContentItemStatus current = itemRepository.findById(id).orElseThrow().getStatus();
                    ContentItemStatus resolved = statusResolver.preview(id);
                    if (current != resolved) {
                        changes.add(mapper.toRepairChange(id, current.name(), resolved.name(), reasonOf(id)));
                    }
                }
            });
            after = ids.getLast();
        }
        List<UUID> instagram = tx.execute(s -> scheduleRepository
                .findByContentVersion_PlatformNameAndStatusInAndDeletedAtIsNull(Platform.INSTAGRAM, UNPUBLISHED).stream()
                .filter(sch -> sch.getHolds().stream().noneMatch(h -> h.getReason() == HoldReason.UNSUPPORTED_MEDIA))
                .map(PostSchedule::getId).sorted().toList());
        String signature = changes.stream().map(c -> "item:" + c.getItemId() + ":" + c.getFrom() + ">" + c.getTo())
                .collect(Collectors.joining("\n")) + "\n" + instagram.stream().map(id -> "ig:" + id).collect(Collectors.joining("\n"));
        return new Plan(changes, instagram, sha256(signature));
    }

    // Lý do = trạng thái sản xuất/lịch của các bản hiện hành, vd "FORMATTED/POSTED, FORMATTED/-" (không nội dung).
    private String reasonOf(UUID itemId) {
        List<VersionPublishingState> states = versionRepository.findPublishingStates(itemId);
        if (states.isEmpty()) {
            return "không có bản nền tảng";
        }
        return states.stream().map(st -> st.status() + "/" + (st.scheduleStatus() == null ? "-" : st.scheduleStatus()))
                .sorted().collect(Collectors.joining(", "));
    }

    private Map<String, Map<String, Long>> enumUsage() {
        Map<String, Map<String, Long>> usage = new LinkedHashMap<>();
        ENUM_COLUMNS.forEach((column, sql) -> {
            Map<String, Long> counts = new LinkedHashMap<>();
            jdbc.query(sql, rs -> {
                counts.put(String.valueOf(rs.getString("v")), rs.getLong("c"));
            });
            usage.put(column, counts);
        });
        return usage;
    }

    private String flywayVersion() {
        try {
            return jdbc.queryForObject(
                    "select version from flyway_schema_history where success = true order by installed_rank desc limit 1",
                    String.class);
        } catch (Exception e) {
            return null; // không có bảng Flyway (vd H2 test) — báo cáo để người vận hành đối chiếu
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }
}
