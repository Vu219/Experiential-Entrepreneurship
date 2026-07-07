package com.aima.content;

import com.aima.dto.ai.GenerateContentPayload;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentIdea;
import com.aima.entity.ContentStrategy;
import com.aima.entity.Trend;
import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import com.aima.mapper.AiContentMapper;
import com.aima.mapper.AiContentMapperImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Hợp đồng JSON gửi Python (POST {ai-service}/generate) — kiểm tra payload đã map từ
 * entity chứa đủ: brand guardrails (brand_keywords/dos/donts), NỘI DUNG trend/idea
 * (không phải id), note; đúng snake_case; và các trường Python bắt buộc không null.
 * Test thuần (không Spring context) — dùng thẳng MapStruct impl đã generate.
 */
class GenerateContentPayloadTest {

    private final AiContentMapper mapper = new AiContentMapperImpl();
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void payloadWithTrendIdeaAndNoteContainsFullContext() throws Exception {
        BrandProfile brand = new BrandProfile();
        brand.setBrandName("AIMA Skincare");
        brand.setIndustry("Mỹ phẩm & Làm đẹp");
        brand.setDescription("Thương hiệu skincare tối giản cho người bận rộn");
        brand.setBrandVoice("Trẻ trung, thân thiện, chuyên nghiệp");
        brand.setTargetAudience("Nữ 22-35, dân văn phòng");
        brand.setContentGoal("Tăng nhận diện thương hiệu");
        brand.setPlatforms(Set.of(Platform.FACEBOOK));
        brand.setBrandKeywords(List.of("skincare tối giản", "da khỏe tự nhiên"));
        brand.setBrandDos(List.of("Giọng tích cực", "Dẫn chứng cụ thể"));
        brand.setBrandDonts(List.of("Quá bán hàng", "Thần thánh hoá công dụng"));

        ContentStrategy strategy = new ContentStrategy();
        strategy.setGoals(List.of("Tăng tương tác", "Tăng follow"));
        strategy.setContentTypes(List.of("Bài viết giáo dục"));
        strategy.setFrequencyCount(3);
        strategy.setFrequencyUnit("WEEK");
        strategy.setPlatforms(Set.of(Platform.FACEBOOK));
        strategy.setTargetAudience(List.of("Gen Z", "dân văn phòng"));
        strategy.setContentStyle(List.of("Gần gũi", "Hiện đại"));
        strategy.setCtaTypes(List.of("Theo dõi kênh"));

        Trend trend = new Trend();
        trend.setTrendName("Skincare tối giản");
        trend.setPlatform(Platform.FACEBOOK);
        trend.setRelevanceScore(new BigDecimal("0.92"));
        trend.setDescription("Routine 3 bước đang được quan tâm mạnh trong nhóm văn phòng");

        ContentIdea idea = new ContentIdea();
        idea.setTrend(trend);
        idea.setIdeaTitle("Routine skincare 3 bước cho người mới bắt đầu");
        idea.setIdeaDescription("Hướng dẫn 3 bước sáng/tối kèm giải thích vì sao đủ dùng");
        idea.setPlatform(Platform.FACEBOOK);
        idea.setSuitabilityLevel(SuitabilityLevel.HIGH);

        GenerateContentPayload payload = GenerateContentPayload.builder()
                .brandProfile(mapper.toBrandProfilePayload(brand))
                .strategy(mapper.toStrategyPayload(strategy))
                .platform(Platform.FACEBOOK.name())
                .trend(mapper.toTrendPayload(trend))
                .idea(mapper.toContentIdeaPayload(idea))
                .note("Nhấn mạnh khuyến mãi tháng 7, tránh từ ngữ chuyên môn da liễu")
                .build();

        String body = json.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
        System.out.println("=== PAYLOAD POST /generate ===\n" + body);

        // snake_case + guardrails
        assertTrue(body.contains("\"brand_keywords\""));
        assertTrue(body.contains("\"brand_dos\""));
        assertTrue(body.contains("\"brand_donts\""));
        assertTrue(body.contains("Thần thánh hoá công dụng"));
        // note
        assertTrue(body.contains("Nhấn mạnh khuyến mãi tháng 7"));
        // trend: NỘI DUNG thật + mức relevance suy từ score + score hợp lệ
        assertTrue(body.contains("Routine 3 bước đang được quan tâm mạnh"));
        assertEquals("High", payload.getTrend().getRelevance());
        assertEquals(0.92, payload.getTrend().getRelevanceScore());
        // idea: nội dung + suitability đúng dạng "High" + list rỗng thay vì null
        assertTrue(body.contains("Routine skincare 3 bước cho người mới bắt đầu"));
        assertEquals("High", payload.getIdea().getSuitabilityLevel());
        assertEquals("Skincare tối giản", payload.getIdea().getTrendName());
        assertEquals(List.of(), payload.getIdea().getExecutionSuggestions());
        assertEquals(List.of(), payload.getIdea().getRelatedGoals());
        assertFalse(body.contains("\"execution_suggestions\" : null"));
    }

    @Test
    void nullableTrendFieldsAreDefensivelyMapped() {
        // Python bắt buộc relevance/relevance_score/description non-null — entity thiếu
        // vẫn phải ra giá trị hợp lệ, không được để null lọt sang.
        Trend bare = new Trend();
        bare.setTrendName("Trend thiếu dữ liệu");
        bare.setPlatform(Platform.THREADS);

        var payload = new AiContentMapperImpl().toTrendPayload(bare);
        assertEquals("Medium", payload.getRelevance());
        assertEquals(0.5, payload.getRelevanceScore());
        assertEquals("", payload.getDescription());
        assertEquals("THREADS", payload.getPlatform());
    }
}
