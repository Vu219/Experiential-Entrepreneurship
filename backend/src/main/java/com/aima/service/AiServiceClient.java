package com.aima.service;

import reactor.core.publisher.Mono;
import com.aima.dto.ai.AnalyzePayload;
import com.aima.dto.ai.AnalyzeResultPayload;
import com.aima.dto.ai.FormatPayload;
import com.aima.dto.ai.FormatResultPayload;
import com.aima.dto.ai.GenerateContentPayload;
import com.aima.dto.ai.GeneratedContentResult;
import com.aima.dto.ai.GoldenHourPayload;
import com.aima.dto.ai.GoldenHourResultPayload;
import com.aima.dto.ai.ListModelsPayload;
import com.aima.dto.ai.ListModelsResultPayload;
import com.aima.dto.ai.OptimizePayload;
import com.aima.dto.ai.OptimizeResultPayload;
import com.aima.dto.ai.PolicyCheckPayload;
import com.aima.dto.ai.PolicyCheckResultPayload;
import com.aima.dto.ai.PolicyFixPayload;
import com.aima.dto.ai.PolicyFixResultPayload;
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

    /**
     * Như {@link #generateContent} nhưng gọi {@code POST /generate/stream} (NDJSON): sự kiện start / delta / reset chuyển cho
     * {@code listener} ngay khi tới, trả kết quả của sự kiện {@code done} (giống hệt body của /generate). {@code cancel}
     * hoàn tất → đóng kết nối (AI service đóng luồng tới provider) và ném
     * {@link com.aima.exception.AiStreamCancelledException} kèm usage một phần.
     */
    GeneratedContentResult generateContentStream(GenerateContentPayload payload, AiStreamListener listener,
                                                 Mono<Void> cancel);

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

    /** POST /policy-fix — gợi ý sửa MỘT bản nền tảng bị từ chối/nghi vấn (người dùng xem diff rồi tự áp dụng). */
    PolicyFixResultPayload policyFix(PolicyFixPayload payload);

    /** POST /policy-check — kiểm tra chính sách tầng 2, chỉ gọi khi bộ luật miễn phí có nghi vấn. */
    PolicyCheckResultPayload policyCheck(PolicyCheckPayload payload);

    /**
     * POST /test-connection — kiểm tra API key provider bằng 1 call model tối thiểu
     * (trang admin "Cấu hình AI"). Payload chứa key plaintext: KHÔNG log payload.
     */
    TestConnectionResultPayload testConnection(TestConnectionPayload payload);

    /**
     * POST /list-models — catalog model của provider (id + tên + token limits; provider
     * KHÔNG trả giá). Payload chứa key plaintext: KHÔNG log payload.
     */
    ListModelsResultPayload listModels(ListModelsPayload payload);
}
