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
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

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

    // FR-84: trang Logs của admin — lọc level và/hoặc một ngày cụ thể.
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<SystemLogResponse>> list(LogLevel level, LocalDate date, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        Page<SystemLog> logs;
        if (level != null && date != null) {
            logs = systemLogRepository.findByLevelAndCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(
                    level, date.atStartOfDay(), date.atTime(LocalTime.MAX), pageable);
        } else if (level != null) {
            logs = systemLogRepository.findByLevelAndDeletedAtIsNullOrderByCreatedAtDesc(level, pageable);
        } else if (date != null) {
            logs = systemLogRepository.findByCreatedAtBetweenAndDeletedAtIsNullOrderByCreatedAtDesc(
                    date.atStartOfDay(), date.atTime(LocalTime.MAX), pageable);
        } else {
            logs = systemLogRepository.findByDeletedAtIsNullOrderByCreatedAtDesc(pageable);
        }

        List<SystemLogResponse> content = systemLogMapper.toResponseList(logs.getContent());
        PageResponse<SystemLogResponse> response = PageResponse.from(logs, content);
        return ApiResponse.success("Lấy log hệ thống thành công", response);
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
