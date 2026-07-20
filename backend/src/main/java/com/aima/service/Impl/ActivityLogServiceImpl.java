package com.aima.service.Impl;

import com.aima.dto.response.ActivityLogResponse;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.ActivityLog;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ActivityResult;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ActivityLogMapper;
import com.aima.repository.ActivityLogRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.ActivityLogWriter;
import com.aima.util.CsvUtil;
import com.aima.util.RequestMeta;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Đọc log hoạt động cho admin + cửa vào duy nhất để ghi (ủy quyền phần ghi cho
 * {@link ActivityLogWriter} chạy nền). Xem {@link ActivityLogService} cho nguyên tắc.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class ActivityLogServiceImpl implements ActivityLogService {

    static final int MAX_PAGE_SIZE = 100;

    /** Cùng trần với export nhật ký usage — giữ một quy ước cho mọi export CSV. */
    static final int EXPORT_MAX_ROWS = 50_000;
    static final int EXPORT_CHUNK = 1_000;

    ActivityLogRepository activityLogRepository;
    ActivityLogWriter activityLogWriter;
    ActivityLogMapper activityLogMapper;
    UserRepository userRepository;

    /**
     * Chụp IP/User-Agent NGAY trên thread request rồi mới đẩy sang writer nền — thread nền
     * không còn request context, gọi RequestMeta ở đó sẽ luôn ra null.
     */
    @Override
    public void record(Entry entry) {
        try {
            activityLogWriter.write(entry, RequestMeta.clientIp(), RequestMeta.userAgent());
        } catch (Exception e) {
            // Hàng đợi executor đầy / bean lỗi — vẫn không được phá luồng nghiệp vụ.
            log.error("[ActivityLog] Không đẩy được vào hàng đợi ghi log: {}", e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<ActivityLogResponse>> list(Filter filter, int page, int size) {
        validateRange(filter);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<ActivityLog> logs = activityLogRepository.search(
                startOf(filter.from()), endOf(filter.to()), filter.userId(),
                filter.actionName(), filter.resultName(), blankToNull(filter.q()), pageable);

        List<ActivityLogResponse> content = toResponseList(logs.getContent());
        PageResponse<ActivityLogResponse> response = PageResponse.from(logs, content);
        return ApiResponse.success("Lấy log hoạt động thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ActivityLogResponse> get(UUID id) {
        ActivityLog activityLog = activityLogRepository.findById(id)
                .filter(row -> row.getDeletedAt() == null)
                .orElseThrow(() -> new AppException(ErrorCode.ACTIVITY_LOG_NOT_FOUND));
        ActivityLogResponse response = toResponseList(List.of(activityLog)).getFirst();
        return ApiResponse.success("Lấy chi tiết log hoạt động thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<String> exportCsv(String actorEmail, Filter filter) {
        validateRange(filter);
        LocalDateTime from = startOf(filter.from());
        LocalDateTime to = endOf(filter.to());
        String q = blankToNull(filter.q());

        long count = activityLogRepository.countMatching(from, to, filter.userId(),
                filter.actionName(), filter.resultName(), q);
        if (count > EXPORT_MAX_ROWS) {
            // KHÔNG cắt cụt im lặng — admin thu hẹp filter rồi export lại (như export usage).
            throw new AppException(ErrorCode.ACTIVITY_LOG_EXPORT_TOO_LARGE);
        }

        StringBuilder csv = new StringBuilder(
                "created_at,user_email,user_full_name,action,action_group,target_type,target_id,"
                        + "result,ip,user_agent,metadata\n");
        for (int chunk = 0; chunk * EXPORT_CHUNK < count; chunk++) {
            List<ActivityLog> rows = activityLogRepository.searchForExport(from, to, filter.userId(),
                    filter.actionName(), filter.resultName(), q, PageRequest.of(chunk, EXPORT_CHUNK));
            toResponseList(rows).forEach(row -> appendCsvRow(csv, row));
        }

        // CSV chứa IP/UA (dữ liệu cá nhân) — chính việc export cũng là một hành động cần vết.
        record(new Entry(ActivityAction.DATA_EXPORTED, null, actorEmail, "ActivityLog", null,
                ActivityResult.SUCCESS, Map.of("rows", count, "filter", describeFilter(filter))));
        return ApiResponse.success("Export log hoạt động thành công", csv.toString());
    }

    /**
     * Làm giàu tên/avatar cho các dòng log: gom userId của cả trang rồi tra MỘT lượt
     * (tránh N+1). User đã bị xoá thì không có trong map — FE lùi về email snapshot.
     */
    private List<ActivityLogResponse> toResponseList(List<ActivityLog> logs) {
        List<UUID> userIds = logs.stream()
                .map(ActivityLog::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<UUID, User> usersById = new HashMap<>();
        if (!userIds.isEmpty()) {
            userRepository.findAllById(userIds).forEach(user -> usersById.put(user.getId(), user));
        }
        return logs.stream()
                .map(row -> activityLogMapper.toResponse(row, usersById.get(row.getUserId())))
                .toList();
    }

    private static void appendCsvRow(StringBuilder csv, ActivityLogResponse row) {
        csv.append(row.getCreatedAt()).append(',')
                .append(CsvUtil.field(row.getUserEmail())).append(',')
                .append(CsvUtil.field(row.getUserFullName())).append(',')
                .append(row.getAction()).append(',')
                .append(row.getActionGroup()).append(',')
                .append(CsvUtil.field(row.getTargetType())).append(',')
                .append(CsvUtil.field(row.getTargetId())).append(',')
                .append(row.getResult()).append(',')
                .append(CsvUtil.field(row.getIp())).append(',')
                .append(CsvUtil.field(row.getUserAgent())).append(',')
                .append(CsvUtil.field(row.getMetadata())).append('\n');
    }

    private static void validateRange(Filter filter) {
        if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
            throw new AppException(ErrorCode.ACTIVITY_LOG_RANGE_INVALID);
        }
    }

    private static LocalDateTime startOf(LocalDate date) {
        return date == null ? null : date.atStartOfDay();
    }

    /** {@code to} là ngày BAO GỒM — mốc trên lấy đầu ngày kế (query dùng {@code < :to}). */
    private static LocalDateTime endOf(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String describeFilter(Filter filter) {
        return "from=" + filter.from() + ", to=" + filter.to() + ", userId=" + filter.userId()
                + ", action=" + filter.action() + ", result=" + filter.result() + ", q=" + filter.q();
    }
}
