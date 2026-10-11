package com.aima.dto.request;

import com.aima.enums.FailedPostBulkAction;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.UUID;

/** Thao tác hàng loạt trên bài lỗi: 1–50 bài, mỗi bài xử lý trong transaction riêng. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class FailedPostBulkRequest {

    @NotNull(message = "FAILED_POST_BULK_INVALID")
    FailedPostBulkAction action;

    @NotEmpty(message = "FAILED_POST_BULK_INVALID")
    @Size(max = 50, message = "FAILED_POST_BULK_INVALID")
    List<@NotNull(message = "FAILED_POST_BULK_INVALID") UUID> postIds;
}
