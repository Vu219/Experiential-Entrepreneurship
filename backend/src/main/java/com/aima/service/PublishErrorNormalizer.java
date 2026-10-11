package com.aima.service;

import com.aima.dto.publish.NormalizedPublishError;
import com.aima.entity.PostingJob;
import com.aima.entity.PublishResult;
import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import com.aima.enums.PublishErrorType;
import com.aima.exception.PublishException;

/**
 * Điểm DUY NHẤT chuẩn hoá lỗi đăng bài về {@link PublishErrorCode} (docs/failed-posts-error-handling-plan.md §3.3):
 * ánh xạ admin ({@code publish_error_mappings}) được xét trước, rồi tới luật mặc định {@code PublishErrorRules}.
 * Người dùng chỉ thấy mã chuẩn hoá — message gốc/chi tiết kỹ thuật (đã redact) chỉ dành cho admin.
 */
public interface PublishErrorNormalizer {

    /** Chuẩn hoá lỗi worker vừa bắt được (gồm mã gốc, thời gian chờ nền tảng yêu cầu, JSON chi tiết đã redact). */
    NormalizedPublishError normalize(Platform platform, PublishException exception);

    /**
     * Mã chuẩn của một lần đăng lỗi đã lưu. Job từ V13 trở đi đã có {@code error_code}; job CŨ được chuẩn hoá
     * lúc đọc từ mã/message đã lưu ({@code result} = publish_result lỗi cùng lần thử nếu có) — không ghi lại DB.
     */
    PublishErrorCode resolve(Platform platform, PostingJob job, PublishResult result);

    /**
     * Như {@link #resolve} nhưng từ giá trị cột đã đọc sẵn (truy vấn tổng hợp native): mã đã lưu thắng; dòng cũ
     * chuẩn hoá từ mã gốc + message + phân loại thô (ánh xạ admin xét trước luật mặc định).
     */
    PublishErrorCode resolveStored(Platform platform, String storedCode, String platformCode, String platformSubcode,
                                   String message, PublishErrorType legacyType);

    /** Mã gốc nền tảng của một lần lỗi (cột mới, hoặc publish_result với dòng cũ). */
    String platformCodeOf(PostingJob job, PublishResult result);

    /** Bỏ cache ánh xạ admin (gọi sau khi thêm/xoá ánh xạ). */
    void evictMappings();
}
