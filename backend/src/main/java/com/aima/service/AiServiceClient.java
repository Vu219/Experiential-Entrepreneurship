package com.aima.service;

import com.aima.dto.ai.AnalyzePayload;
import com.aima.dto.ai.AnalyzeResultPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.ai.OptimizePayload;
import com.aima.dto.ai.OptimizeResultPayload;
import com.aima.dto.ai.RegeneratePartPayload;
import com.aima.dto.ai.RegeneratePartResultPayload;
import com.aima.dto.ai.ResearchPayload;
import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.ai.TestConnectionPayload;
import com.aima.dto.ai.TestConnectionResultPayload;

/**
 * Wrapper duy nhất để gọi AI service (Python/FastAPI, docs/Implementation_Strategy.md §1).
 */
public interface AiServiceClient {

    /** POST /generate — FR-24..FR-30, FR-32. */
    GeneratedContentResult generateContent(GenerateContentPayload payload);

    /** POST /research — FR-20..FR-22 (phần phân tích của FR-19/23). */
    ResearchResultPayload research(ResearchPayload payload);

    /** POST /format — FR-40, FR-42, FR-44, Threads (một ContentVersion mỗi nền tảng, FR-46). */
    FormatResultPayload format(FormatPayload payload);

    /** POST /golden-hours — FR-48 (mặc định theo nền tảng cho tới khi có ≥10 bài đã phân tích). */
    GoldenHourResultPayload goldenHours(GoldenHourPayload payload);

    /** POST /regenerate-part — tạo lại MỘT phần kịch bản (hook/body/cta × content/scene). */
    RegeneratePartResultPayload regeneratePart(RegeneratePartPayload payload);

    /** POST /analyze — FR-63/FR-64: success factors + insights từ analytics các bài đã đăng. */
    AnalyzeResultPayload analyze(AnalyzePayload payload);

    /** POST /optimize — FR-65/FR-66: đề xuất điều chỉnh chiến lược + cải tiến bài tương lai. */
    OptimizeResultPayload optimize(OptimizePayload payload);

    /**
     * POST /test-connection — kiểm tra API key provider bằng 1 call model tối thiểu
     * (trang admin "Cấu hình AI"). Payload chứa key plaintext: KHÔNG log payload.
     */
    TestConnectionResultPayload testConnection(TestConnectionPayload payload);
}
