package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "UserResponse", description = "User account details.")
public class UserResponse {
    @Schema(description = "Unique user identifier.", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    UUID id;

    @Schema(description = "Account username.", example = "johndoe")
    String username;

    @Schema(description = "Display name.", example = "John Doe")
    String fullName;

    @Schema(description = "Email address.", example = "john.doe@gmail.com")
    String email;

    @Schema(description = "Phone number.", example = "0901234567")
    String phone;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Schema(description = "Hashed password (BCrypt). Never serialized in responses.", hidden = true)
    String password;

    @Schema(description = "Account status.", example = "ACTIVE", allowableValues = {"ACTIVE", "LOCKED", "PENDING_DELETE"})
    String status;

    @Schema(description = "Avatar image URL.", example = "https://cdn.example.com/avatars/johndoe.png")
    String avatarUrl;

    @Schema(description = "Account creation timestamp.", example = "2026-06-08T09:30:00")
    LocalDateTime createdAt;

    @Schema(description = "Timestamp of the last password change.", example = "2026-06-08T09:30:00")
    LocalDateTime lastPasswordChangeAt;

    @Schema(description = "Role assigned to the user.")
    RoleResponse role;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Schema(name = "RoleResponse", description = "Role assigned to a user.")
    public static class RoleResponse {
        @Schema(description = "Unique role identifier.", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
        UUID id;

        @Schema(description = "Role name.", example = "USER")
        String roleName;

        @Schema(description = "Role description.", example = "Standard application user")
        String description;
    }
}