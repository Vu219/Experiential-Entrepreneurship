package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * URL OAuth dialog của Meta để FE redirect người dùng tới.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AuthorizationUrlResponse", description = "URL bắt đầu luồng OAuth.")
public class AuthorizationUrlResponse {
    @Schema(description = "URL OAuth dialog để FE chuyển hướng người dùng.")
    String authorizationUrl;
}
