package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SystemLogResponse;
import com.aima.entity.SystemLog;
import com.aima.enums.LogLevel;
import com.aima.mapper.SystemLogMapper;
import com.aima.repository.SystemLogRepository;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * FR-74: lưu log lỗi hệ thống xuống bảng system_logs. REQUIRES_NEW để dòng log sống sót
 * kể cả khi transaction nghiệp vụ đang lỗi bị rollback.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class SystemLogServiceImpl implements SystemLogService {

    // Giữ stack trace đủ để debug nhưng không phình bảng log.
    static final int MAX_DETAIL_LENGTH = 4000;

    SystemLogRepository systemLogRepository;
    SystemLogMapper systemLogMapper;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void error(String module, String message, Throwable cause) {
        save(LogLevel.ERROR, module, message, stackTraceOf(cause));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void warn(String module, String message) {
        save(LogLevel.WARN, module, message);
    }

    // FR-84: trang Logs của admin — lọc level + ngày + tìm kiếm; grouped = gom dòng trùng (×N).
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<SystemLogResponse>> list(LogLevel level, LocalDate date, String q,
                                                             boolean grouped, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        LocalDateTime from = date != null ? date.atStartOfDay() : null;
        LocalDateTime to = date != null ? date.atTime(LocalTime.MAX) : null;
        String search = (q == null || q.isBlank()) ? null : q.trim();

        PageResponse<SystemLogResponse> response = grouped
                ? listGrouped(level, from, to, search, pageable)
                : listFlat(level, from, to, search, pageable);
        return ApiResponse.success("Lấy log hệ thống thành công", response);
    }

    private PageResponse<SystemLogResponse> listFlat(LogLevel level, LocalDateTime from, LocalDateTime to,
                                                     String q, Pageable pageable) {
        Page<SystemLog> logs = systemLogRepository.search(
                level != null ? level.name() : null, from, to, q, pageable);
        List<SystemLogResponse> content = systemLogMapper.toResponseList(logs.getContent());
        return PageResponse.from(logs, content);
    }

    // Native trả level dạng String → bind level.name(); cột: [0]id [1]level [2]module [3]message [4]count [5]lastAt.
    private PageResponse<SystemLogResponse> listGrouped(LogLevel level, LocalDateTime from, LocalDateTime to,
                                                        String q, Pageable pageable) {
        Page<Object[]> groups = systemLogRepository.searchGrouped(
                level != null ? level.name() : null, from, to, q, pageable);
        List<SystemLogResponse> content = groups.getContent().stream()
                .map(r -> systemLogMapper.toGroupResponse(
                        UUID.fromString((String) r[0]),
                        LogLevel.valueOf((String) r[1]),
                        (String) r[2],
                        (String) r[3],
                        toLocalDateTime(r[5]),
                        ((Number) r[4]).longValue()))
                .toList();
        return PageResponse.from(groups, content);
    }

    // MAX(created_at) native có thể trả LocalDateTime (Hibernate) hoặc java.sql.Timestamp tuỳ driver.
    private static LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime();
        }
        return (LocalDateTime) value;
    }

    private void save(LogLevel level, String module, String message, String detail) {
        try {
            systemLogRepository.save(systemLogMapper.toLog(level, module,
                    message == null ? "(không có message)" : message, detail));
        } catch (Exception e) {
            // Best-effort: ghi log hỏng (vd DB down) không được phá luồng đang lỗi sẵn.
            log.error("[SystemLog] Không thể lưu log [{}] {}: {}", level, module, message, e);
        }
    }

    private void save(LogLevel level, String module, String message) {
        save(level, module, message, null);
    }

    private static String stackTraceOf(Throwable cause) {
        if (cause == null) {
            return null;
        }
        StringWriter writer = new StringWriter();
        cause.printStackTrace(new PrintWriter(writer));
        String trace = writer.toString();
        return trace.length() > MAX_DETAIL_LENGTH ? trace.substring(0, MAX_DETAIL_LENGTH) : trace;
    }
}
