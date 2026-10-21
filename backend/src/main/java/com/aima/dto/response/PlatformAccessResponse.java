package com.aima.dto.response;

import com.aima.enums.Platform;
import com.aima.enums.PlatformLockReason;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Quyền dùng một nền tảng của user hiện tại = mở ở cấp hệ thống VÀ được gói cho phép (khoá hệ thống luôn thắng). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformAccessResponse", description = "Quyền dùng một nền tảng của user hiện tại.")
public class PlatformAccessResponse {
    Platform platform;
    boolean systemEnabled;
    String reasonVi;
    String reasonEn;
    boolean planAllowed;
    boolean usable;

    @Schema(description = "null khi dùng được.", example = "PLATFORM_DISABLED")
    PlatformLockReason lockReason;
}
