package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "MeResponse", description = "Identity of the currently authenticated user.")
public class MeResponse {
    @Schema(description = "Unique user identifier.", example = "3fa85f64-5717-4562-b3fc-2c963f66afa6")
    UUID id;

    @Schema(description = "Email address.", example = "john.doe@gmail.com")
    String email;

    @Schema(description = "Role name assigned to the user.", example = "USER")
    String role;

    @Schema(description = "Display name.", example = "John Doe")
    String fullName;

    @Schema(description = "Phone number.", example = "0901234567")
    String phone;

    @Schema(description = "Date of birth.", example = "1998-05-20")
    LocalDate dateOfBirth;

    @Schema(description = "Authentication provider (LOCAL or GOOGLE).", example = "GOOGLE")
    String provider;

    @Schema(description = "Avatar image URL.", example = "https://cdn.example.com/avatars/johndoe.png")
    String avatarUrl;

    @Schema(description = "Account status (ACTIVE, LOCKED, PENDING_DELETE).", example = "ACTIVE")
    String status;

    @Schema(description = "Service plan of the user (FREE, PLUS, PRO). Drives the plan label in the "
            + "app header and the sidebar upgrade card.", example = "FREE")
    String plan;

    @Schema(description = "When the account will be permanently purged. Set only while status is PENDING_DELETE.",
            example = "2026-07-21T00:00:00")
    LocalDateTime deletionDate;

    @Schema(description = "True when the user has filled in all required profile fields " +
            "(fullName, phone, dateOfBirth). False forces the frontend to the complete-profile screen.",
            example = "true")
    boolean profileCompleted;
}
