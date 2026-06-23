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
public class ResetPasswordRequest {
    @NotBlank(message = "EMAIL_REQUIRED")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$",
            message = "INVALID_EMAIL_FORMAT"
    )
    String email;

    @NotBlank(message = "OTP_REQUIRED")
    String otpCode;

    @NotBlank(message = "PASSWORD_REQUIRED")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$", message = "WEAK_PASSWORD")
    String newPassword;

    @NotBlank(message = "CONFIRM_PASSWORD_REQUIRED")
    String confirmPassword;
}