package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "ResearchSourceResponse", description = "A data source used by a research session and what it returned.")
public class ResearchSourceResponse {

    @Schema(description = "Source name.", example = "web_search")
    String name;

    @Schema(description = "ok | empty | skipped | failed", example = "ok")
    String status;

    @Schema(description = "Number of items the source contributed.")
    Integer items;
}
