package com.aima.service.Impl;

import com.aima.enums.LogLevel;
import com.aima.mapper.SystemLogMapper;
import com.aima.repository.SystemLogRepository;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;

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
