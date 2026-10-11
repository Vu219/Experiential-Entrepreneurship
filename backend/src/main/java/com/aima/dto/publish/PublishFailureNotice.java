package com.aima.dto.publish;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;

import java.util.UUID;

/**
 * Giá trị cần để báo một lần đăng THẤT BẠI CHUNG CUỘC — chụp trong transaction ghi lỗi, dùng SAU commit
 * ({@code PublishFailureNotifier}). Chỉ giá trị vô hướng: thông báo chạy ngoài transaction của worker để
 * lỗi unique {@code dedupe_key} (hai bài cùng tài khoản lỗi cùng lúc) không làm hỏng transaction ghi kết quả.
 */
public record PublishFailureNotice(
        UUID userId,
        UUID accountId,
        String accountName,
        Platform platform,
        UUID postId,
        UUID jobId,
        PublishErrorCode code) {
}
