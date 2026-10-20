package com.aima.exception;

import com.aima.dto.response.PlanLimitViolationResponse;

/**
 * Vượt giới hạn tính năng theo gói — {@link AppException} mang thêm chi tiết để {@code GlobalExceptionHandler} trả
 * vào {@code result} (FE biết giới hạn nào để hiện nút nâng cấp đúng chỗ).
 */
public class PlanLimitException extends AppException {

    private final transient PlanLimitViolationResponse detail;

    public PlanLimitException(ErrorCode errorCode, PlanLimitViolationResponse detail) {
        super(errorCode);
        this.detail = detail;
    }

    public PlanLimitViolationResponse getDetail() {
        return detail;
    }
}
