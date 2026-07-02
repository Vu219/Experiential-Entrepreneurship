package com.aima.service;

import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;

/**
 * Wrapper duy nhất để gọi AI service (Python/FastAPI, docs/Implementation_Strategy.md §1).
 */
public interface AiServiceClient {

    /** POST /generate — FR-24..FR-30, FR-32. */
    GeneratedContentResult generateContent(GenerateContentPayload payload);

    /** POST /research — FR-20..FR-22 (phần phân tích của FR-19/23). */
    ResearchResultPayload research(ResearchPayload payload);
}
