package com.aima.exception;

import com.aima.service.SystemLogService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.util.DisconnectedClientHelper;
import com.aima.dto.response.ApiResponse;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@ControllerAdvice
@Slf4j
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private static final String MIN_ATTRIBUTE = "min";
    private static final String MAX_ATTRIBUTE = "max";
    /** Thông điệp IOException khi client đóng socket (Linux/macOS + Windows) mà DisconnectedClientHelper chưa nhận. */
    private static final List<String> DISCONNECT_MESSAGES = List.of(
            "broken pipe", "connection reset", "aborted", "forcibly closed");

    private final SystemLogService systemLogService;

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse> handlingUnreadableRequest(HttpMessageNotReadableException exception) {
        return handlingAppException(new AppException(ErrorCode.INVALID_REQUEST));
    }

    // Client ngắt kết nối (F5, đóng tab, StrictMode huỷ EventSource của SSE /realtime/stream): không phải lỗi hệ thống
    // và socket đã chết — không ghi body. Trả null = request đã xử lý xong, Spring không ghi gì thêm.
    @ExceptionHandler(value = {AsyncRequestNotUsableException.class, ClientAbortException.class})
    public ResponseEntity<ApiResponse> handlingClientDisconnect(Exception exception) {
        log.debug("Client disconnected: {}", exception.toString());
        return null;
    }

    @ExceptionHandler(value = Exception.class)
    public ResponseEntity<ApiResponse> handlingRuntimeException(Exception exception, HttpServletResponse response) {
        if (isClientDisconnect(exception, response)) {
            return handlingClientDisconnect(exception);
        }

        log.error("Unhandled exception", exception);
        // FR-74: lỗi 500 chưa phân loại là lỗi hệ thống — lưu DB cho trang Logs của admin (FR-84).
        systemLogService.error("api", exception.toString(), exception);

        // Response đã gửi header (vd luồng SSE text/event-stream): không thể đổi sang JSON ApiResponse nữa —
        // ghi tiếp chỉ sinh HttpMessageNotWritableException.
        if (response.isCommitted() || isEventStream(response)) {
            return null;
        }

        ApiResponse apiResponse = new ApiResponse();

        apiResponse.setCode(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode());
        apiResponse.setMessage(ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(apiResponse);
    }

    // Đường dẫn không tồn tại (Spring 6+ ném NoResourceFoundException) — trả 404 thay vì để
    // catch-all Exception biến nó thành 500 "Uncategorized error" gây khó debug (API-05).
    @ExceptionHandler(value = NoResourceFoundException.class)
    public ResponseEntity<ApiResponse> handlingNoResourceFound(NoResourceFoundException exception) {
        ApiResponse apiResponse = new ApiResponse();

        apiResponse.setCode(HttpStatus.NOT_FOUND.value());
        apiResponse.setMessage("Không tìm thấy đường dẫn: " + exception.getResourcePath());

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(apiResponse);
    }

    // @PathVariable/@RequestParam convert thất bại (vd. StringToPlatformConverter ném AppException) —
    // Spring bọc trong MethodArgumentTypeMismatchException nên phải bóc ra để trả đúng envelope.
    @ExceptionHandler(value = MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse> handlingTypeMismatch(MethodArgumentTypeMismatchException exception,
                                                            HttpServletResponse response) {
        Throwable cause = exception.getCause();
        while (cause != null) {
            if (cause instanceof AppException appException) {
                return handlingAppException(appException);
            }
            cause = cause.getCause();
        }
        return handlingRuntimeException(exception, response);
    }

    @ExceptionHandler(value = AppException.class)
    public ResponseEntity<ApiResponse> handlingAppException(AppException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        ApiResponse apiResponse = new ApiResponse();

        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(errorCode.getMessage());
        if (exception instanceof PlanLimitException planLimit) {
            apiResponse.setResult(planLimit.getDetail());
        }

        return ResponseEntity
                .status(errorCode.getStatusCode())
                .body(apiResponse);
    }

    @ExceptionHandler(value = AccessDeniedException.class)
    public ResponseEntity<ApiResponse> handlingAccessDeniedException(AccessDeniedException exception) {
        ErrorCode errorCode = ErrorCode.UNAUTHORIZED;

        return ResponseEntity.status(errorCode.getStatusCode()).body(
                ApiResponse.builder()
                        .code(errorCode.getCode())
                        .message(errorCode.getMessage())
                        .build()
        );
    }

    @ExceptionHandler(value = AuthenticationException.class)
    public ResponseEntity<ApiResponse> handlingAuthenticationException(AuthenticationException exception) {
        ErrorCode errorCode = ErrorCode.UNAUTHENTICATED;

        return ResponseEntity.status(errorCode.getStatusCode()).body(
                ApiResponse.builder()
                        .code(errorCode.getCode())
                        .message(errorCode.getMessage())
                        .build()
        );
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse> handleInvalidation(MethodArgumentNotValidException exception) {
        String enumKey = exception.getFieldError().getDefaultMessage();

        ErrorCode errorCode = ErrorCode.INVALID_KEY;

        Map<String, Object> attributes = null;

        try {
            errorCode = ErrorCode.valueOf(enumKey);

            var constraintViolations = exception.getBindingResult()
                    .getAllErrors().get(0).unwrap(ConstraintViolation.class);

            attributes = constraintViolations.getConstraintDescriptor().getAttributes();

            log.info(attributes.toString());
        } catch (IllegalArgumentException e) {
            // Validation message does not match an ErrorCode enum key -> deliberate fallback to INVALID_KEY.
            log.warn("Validation message key '{}' not found in ErrorCode enum; falling back to INVALID_KEY", enumKey);
        }

        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setCode(errorCode.getCode());
        apiResponse.setMessage(Objects.nonNull(attributes) ?
                mapAttribute(errorCode.getMessage(), attributes) :
                errorCode.getMessage());

        return ResponseEntity.badRequest().body(apiResponse);
    }

    //hàm để thay {} trong errorCode
    private String mapAttribute(String message, Map<String, Object> attributes) {
        String minValue = String.valueOf(attributes.get(MIN_ATTRIBUTE));

        return message.replace("{" + MIN_ATTRIBUTE + "}", minValue);
    }

    private static boolean isClientDisconnect(Throwable exception, HttpServletResponse response) {
        if (DisconnectedClientHelper.isClientDisconnectedException(exception)) {
            return true;
        }
        // IOException trần chỉ coi là client ngắt khi response đã commit — lỗi mạng của lời gọi ra ngoài (Meta, AI)
        // xảy ra trước khi ghi response và vẫn phải log ERROR.
        if (!response.isCommitted()) {
            return false;
        }
        for (Throwable t = exception; t != null; t = t.getCause()) {
            if (t instanceof IOException && t.getMessage() != null) {
                String message = t.getMessage().toLowerCase(Locale.ROOT);
                if (DISCONNECT_MESSAGES.stream().anyMatch(message::contains)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean isEventStream(HttpServletResponse response) {
        String contentType = response.getContentType();
        return contentType != null && contentType.startsWith(MediaType.TEXT_EVENT_STREAM_VALUE);
    }
}
