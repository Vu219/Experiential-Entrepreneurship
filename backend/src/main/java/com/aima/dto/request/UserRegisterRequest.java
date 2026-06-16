package com.aima.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "UserRegisterRequest", description = "Payload for registering a new user account.")
public class UserRegisterRequest {
    @NotBlank(message = "PASSWORD_REQUIRED")
    @Size(min = 6, message = "INVALID_PASSWORD")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{6,}$",
            message = "INVALID_PASSWORD")
    @Schema(description = "Min 6 chars, must contain at least one letter and one digit.",
            example = "Passw0rd", minLength = 6, requiredMode = Schema.RequiredMode.REQUIRED)
    String password;

    @NotBlank(message = "FULLNAME_REQUIRED")
    @Size(max = 255, message = "INVALID_FULLNAME")
    @Schema(description = "Display name, up to 255 characters.", example = "John Doe",
            maxLength = 255, requiredMode = Schema.RequiredMode.REQUIRED)
    String fullName;

    @NotBlank(message = "EMAIL_REQUIRED")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$",
            message = "INVALID_EMAIL_FORMAT"
    )
    @Schema(description = "Unique, valid email address.", example = "john.doe@gmail.com",
            requiredMode = Schema.RequiredMode.REQUIRED)
    String email;

    @Pattern(regexp = "^[0-9]{10,11}$", message = "INVALID_PHONE")
    @Schema(description = "Phone number, 10-11 digits.", example = "0901234567")
    String phone;
}
