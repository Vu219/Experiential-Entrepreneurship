package com.aima.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

/** Một model trong chuỗi dự phòng của routing ({@code position} 0 = thử ngay sau model chính). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiRoutingFallbackResponse {

    Integer position;

    UUID modelId;

    String modelCode;

    String providerCode;
}
