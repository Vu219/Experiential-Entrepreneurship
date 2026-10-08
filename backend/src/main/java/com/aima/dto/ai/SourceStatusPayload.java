package com.aima.dto.ai;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Mirrors ai/src/schemas.py SourceStatus — một nguồn dữ liệu đã dùng trong phiên
 * (status: ok | empty | skipped | failed). Lưu nguyên dạng JSON vào trend_research_sessions.data_sources.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SourceStatusPayload {

    String name;

    String status;

    Integer items;
}
