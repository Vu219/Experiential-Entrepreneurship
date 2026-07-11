package com.aima.dto.request;

import com.aima.enums.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "UserStatusUpdateRequest", description = "Admin lock/unlock of a user account (FR-80).")
public class UserStatusUpdateRequest {

    @NotNull(message = "USER_STATUS_REQUIRED")
    @Schema(description = "LOCKED to lock the account, ACTIVE to unlock.", example = "LOCKED")
    UserStatus status;
}
