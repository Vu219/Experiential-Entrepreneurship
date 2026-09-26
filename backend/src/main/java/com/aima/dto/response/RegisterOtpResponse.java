package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "RegisterOtpResponse", description = "Kết quả gửi OTP đăng ký — FE dùng để đếm ngược.")
public class RegisterOtpResponse {
    @Schema(description = "Email (đã chuẩn hoá chữ thường) đang chờ xác thực.", example = "john.doe@gmail.com")
    String email;

    @Schema(description = "Số giây mã OTP còn hiệu lực.", example = "300")
    long expiresInSeconds;

    @Schema(description = "Số giây phải chờ trước khi được gửi lại mã.", example = "60")
    long resendAfterSeconds;
}
