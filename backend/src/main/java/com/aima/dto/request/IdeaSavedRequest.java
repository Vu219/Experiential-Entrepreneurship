package com.aima.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** Lưu / bỏ lưu một ý tưởng content (PUT /trend-research/ideas/{id}/saved). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class IdeaSavedRequest {

    @NotNull(message = "INVALID_REQUEST")
    Boolean saved;
}
