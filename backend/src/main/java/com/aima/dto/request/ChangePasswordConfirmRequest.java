package com.aima.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChangePasswordConfirmRequest {
    @NotBlank(message = "OTP_REQUIRED")
    String otpCode;

    @NotBlank(message = "PASSWORD_REQUIRED")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", message = "WEAK_PASSWORD")
    String newPassword;

    @NotBlank(message = "CONFIRM_PASSWORD_REQUIRED")
    String confirmPassword;
}
