package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRoutingResponse {

    UUID id;

    String taskCode;

    UUID primaryModelId;

    String primaryModelCode;

    String primaryProviderCode;

    UUID fallbackModelId;

    String fallbackModelCode;

    String fallbackProviderCode;

    Double temperature;

    Integer maxTokens;

    Boolean enabled;
}
