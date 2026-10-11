package com.aima.dto.request;

import com.aima.enums.Platform;
import com.aima.enums.PublishErrorCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Admin ánh xạ chữ ký lỗi nền tảng → mã AIMA CÓ SẴN (hàng đợi "chưa phân loại"). subcode / mẫu message bỏ trống
 * = "mọi". {@code applyToExisting} = áp luôn cho các lần lỗi UNKNOWN đã lưu cùng chữ ký.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PublishErrorMappingRequest {

    @NotNull(message = "PUBLISH_ERROR_MAPPING_INVALID")
    Platform platform;

    @NotBlank(message = "PUBLISH_ERROR_MAPPING_INVALID")
    @Size(max = 50, message = "PUBLISH_ERROR_MAPPING_INVALID")
    String platformCode;

    @Size(max = 50, message = "PUBLISH_ERROR_MAPPING_INVALID")
    String platformSubcode;

    @Size(max = 200, message = "PUBLISH_ERROR_MAPPING_INVALID")
    String messagePattern;

    @NotNull(message = "PUBLISH_ERROR_MAPPING_INVALID")
    PublishErrorCode errorCode;

    @Size(max = 500, message = "PUBLISH_ERROR_MAPPING_INVALID")
    String note;

    boolean applyToExisting;
}
