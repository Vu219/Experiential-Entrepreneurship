package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "DeleteAccountResponse", description = "Result of a delete-account or restore-account request.")
public class DeleteAccountResponse {

    @Schema(description = "Current account status after the operation.", example = "PENDING_DELETE")
    String status;

    @Schema(description = "Exact timestamp when the account will be permanently purged. Null if account was restored.", example = "2026-07-17T00:00:00")
    LocalDateTime deletionDate;

    @Schema(description = "Number of days remaining before permanent deletion. Null if account was restored.", example = "30")
    Long daysRemaining;

    @Schema(description = "Human-readable summary of the operation result.", example = "Your account is scheduled for deletion in 30 days.")
    String message;
}
