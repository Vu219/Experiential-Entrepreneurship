package com.aima.exception;

import com.aima.dto.response.ApiResponse;
import com.aima.service.SystemLogService;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Client ngắt kết nối (SSE /realtime/stream) không phải lỗi hệ thống và không được ghi ApiResponse lên response đã chết. */
class GlobalExceptionHandlerDisconnectTest {

    private final SystemLogService systemLogService = mock(SystemLogService.class);
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(systemLogService);

    private static MockHttpServletResponse sseResponse() throws IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setContentType("text/event-stream");
        response.flushBuffer(); // đã commit
        return response;
    }

    @Test
    void asyncRequestNotUsable_writesNothing() {
        assertNull(handler.handlingClientDisconnect(new AsyncRequestNotUsableException("flushBuffer failed")));
    }

    @Test
    void wrappedClientAbort_viaCatchAll_writesNothingAndIsNotLogged() throws Exception {
        Exception wrapped = new RuntimeException(new ClientAbortException(
                new IOException("An established connection was aborted by the software in your host machine")));

        assertNull(handler.handlingRuntimeException(wrapped, sseResponse()));
        verify(systemLogService, never()).error(any(), any(), any());
    }

    @Test
    void bareIOExceptionOnCommittedResponse_isTreatedAsDisconnect() throws Exception {
        assertNull(handler.handlingRuntimeException(new IOException("Connection reset"), sseResponse()));
        verify(systemLogService, never()).error(any(), any(), any());
    }

    @Test
    void realErrorOnEventStream_isLoggedButNoJsonBodyWritten() throws Exception {
        assertNull(handler.handlingRuntimeException(new IllegalStateException("boom"), sseResponse()));
        verify(systemLogService).error(any(), any(), any());
    }

    @Test
    void bareIOExceptionBeforeCommit_isStillA500() {
        // vd lời gọi Meta/AI bị reset trước khi ghi response — vẫn là lỗi hệ thống
        ResponseEntity<ApiResponse> result = handler.handlingRuntimeException(new IOException("Connection reset"),
                new MockHttpServletResponse());

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, result.getStatusCode());
        verify(systemLogService).error(any(), any(), any());
    }
}
