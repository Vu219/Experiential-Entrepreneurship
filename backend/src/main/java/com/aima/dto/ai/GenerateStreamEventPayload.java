package com.aima.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Một dòng NDJSON của {@code POST /generate/stream} (mirror sự kiện ở ai/src/api/routes.py):
 * {@code start} · {@code delta{path, append, replace?}} · {@code reset{reason}} · {@code done{result}} ·
 * {@code error{error_code, message, attempts}}.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class GenerateStreamEventPayload {
    String type;
    String provider;
    String model;
    @JsonProperty("input_tokens")
    Long inputTokens;
    String path;
    String append;
    Boolean replace;
    String reason;
    GeneratedContentResult result;
    @JsonProperty("error_code")
    String errorCode;
    String message;
    List<LlmAttemptPayload> attempts;
}
