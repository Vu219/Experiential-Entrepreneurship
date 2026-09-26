package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "RegisterVerifyRequest", description = "Bước 2 đăng ký: email + mã OTP đã gửi về email đó.")
public class RegisterVerifyRequest {
    @NotBlank(message = "EMAIL_REQUIRED")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$",
            message = "INVALID_EMAIL_FORMAT"
    )
    @Schema(example = "john.doe@gmail.com", requiredMode = Schema.RequiredMode.REQUIRED)
    String email;

    @NotBlank(message = "OTP_REQUIRED")
    @Pattern(regexp = "^[0-9]{6}$", message = "INVALID_OTP")
    @Schema(description = "Mã OTP 6 chữ số.", example = "123456", requiredMode = Schema.RequiredMode.REQUIRED)
    String otpCode;
}
