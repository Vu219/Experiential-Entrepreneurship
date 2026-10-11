package com.aima.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Lý do BẮT BUỘC cho thao tác admin thay người dùng (ghi vào activity_logs). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AdminActionReasonRequest {

    @NotBlank(message = "ADMIN_ACTION_REASON_REQUIRED")
    @Size(max = 500, message = "ADMIN_ACTION_REASON_REQUIRED")
    String reason;
}
