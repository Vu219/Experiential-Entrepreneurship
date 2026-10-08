package com.aima.trend;

import com.aima.dto.ai.ResearchResultPayload;
import com.aima.dto.response.ContentIdeaResponse;
import com.aima.dto.response.TrendResearchSessionResponse;
import com.aima.dto.response.TrendResponse;
import com.aima.entity.ContentIdea;
import com.aima.entity.Trend;
import com.aima.entity.TrendResearchSession;
import com.aima.enums.Platform;
import com.aima.enums.SuitabilityLevel;
import com.aima.enums.TrendMomentum;
import com.aima.enums.TrendType;
import com.aima.mapper.TrendResearchMapper;
import com.aima.mapper.TrendResearchMapperImpl;
import com.aima.repository.TrendRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Hợp đồng /research dựa trên bằng chứng (ai/src/schemas.py ResearchResult): decode bằng codec mặc định
 * của WebClient → entity (cột jsonb dạng String) → response, không mất trường nào; giá trị lạ không làm
 * hỏng phiên.
 */
class TrendResearchEvidenceMappingTest {

    private static final String AI_JSON = """
            {"industry":"spa","summary":"Tóm tắt","grounded":true,"web_searches":4,
             "sources_used":[{"name":"web_search","status":"ok","items":6},{"name":"threads","status":"skipped","items":0}],
             "trends":[{"trend_name":"Skincare mùa thu","platform":"Facebook","relevance":"High","relevance_score":0.86,
                        "description":"d","trend_type":"Niche","momentum":"Rising","act_by":"2026-10-20",
                        "hashtags":["#skincare","#muathu"],
                        "evidence":[{"title":"Báo A","url":"https://baoa.vn/x","source":"web"},
                                    {"title":"Phụ nữ VN 20/10","url":"","source":"calendar"}],
                        "confidence":"High"},
                       {"trend_name":"Lạ","platform":"Facebook","relevance":"Low","relevance_score":0.2,
                        "description":"d","trend_type":"Weird","momentum":null,"act_by":"20/10/2026"}],
             "content_ideas":[{"idea_title":"Video 3 bước","idea_description":"d","trend_name":"Skincare mùa thu",
                               "platform":"Facebook","suitability_level":"High",
                               "execution_suggestions":["Hook 3 giây","Quay dọc"],"related_goals":["awareness"]}],
             "tokens_used":120,"llm_attempts":[{"provider":"google","model":"g","outcome":"ok"}]}
            """;

    private final TrendResearchMapper mapper = new TrendResearchMapperImpl();

    private static ResearchResultPayload decode() {
        WebClient client = WebClient.builder()
                .exchangeFunction(req -> Mono.just(ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(AI_JSON).build()))
                .build();
        return client.post().uri("http://ai/research").retrieve().bodyToMono(ResearchResultPayload.class).block();
    }

    @Test
    void evidenceFieldsSurviveAiToEntityToResponse() {
        ResearchResultPayload result = decode();

        Trend trend = mapper.toTrend(result.getTrends().get(0));
        assertEquals(TrendType.NICHE, trend.getTrendType());
        assertEquals(TrendMomentum.RISING, trend.getMomentum());
        assertEquals(SuitabilityLevel.HIGH, trend.getRelevance());
        assertEquals(SuitabilityLevel.HIGH, trend.getConfidence());
        assertEquals(LocalDate.of(2026, 10, 20), trend.getActBy());
        assertEquals(Platform.FACEBOOK, trend.getPlatform());

        TrendResponse response = mapper.toTrendResponse(trend);
        assertEquals(List.of("#skincare", "#muathu"), response.getHashtags());
        assertEquals(2, response.getEvidence().size());
        assertEquals("https://baoa.vn/x", response.getEvidence().get(0).getUrl());
        assertEquals("calendar", response.getEvidence().get(1).getSource());

        ContentIdea idea = mapper.toContentIdea(result.getContentIdeas().get(0));
        ContentIdeaResponse ideaResponse = mapper.toContentIdeaResponse(idea);
        assertEquals(List.of("Hook 3 giây", "Quay dọc"), ideaResponse.getExecutionSuggestions());
        assertEquals(List.of("awareness"), ideaResponse.getRelatedGoals());
    }

    @Test
    void unknownValuesDegradeToNullInsteadOfFailingTheSession() {
        Trend trend = mapper.toTrend(decode().getTrends().get(1));
        assertNull(trend.getTrendType());
        assertNull(trend.getMomentum());
        assertNull(trend.getActBy());
        assertNull(trend.getConfidence());

        TrendResponse response = mapper.toTrendResponse(trend);
        assertEquals(List.of(), response.getHashtags());
        assertEquals(List.of(), response.getEvidence());
    }

    @Test
    void sessionKeepsGroundingAndDataSources() {
        TrendResearchSession session = new TrendResearchSession();
        mapper.applyResult(decode(), session);
        assertEquals("Tóm tắt", session.getSummary());
        assertTrue(session.getGrounded());
        assertEquals(4, session.getWebSearches());

        TrendResearchSessionResponse response = mapper.toSessionResponse(session);
        assertEquals(2, response.getDataSources().size());
        assertEquals("web_search", response.getDataSources().get(0).getName());
        assertEquals("skipped", response.getDataSources().get(1).getStatus());
    }

    @Test
    void previousTrendMarksUserDeletedTrendsAsRejected() {
        LocalDateTime at = LocalDateTime.of(2026, 10, 5, 2, 0);
        TrendRepository.PreviousTrendView deleted = view("A", at, at.plusHours(3));
        TrendRepository.PreviousTrendView kept = view("B", at, null);

        assertTrue(mapper.toPreviousTrendPayload(deleted).isRejected());
        assertFalse(mapper.toPreviousTrendPayload(kept).isRejected());
        assertEquals(LocalDate.of(2026, 10, 5), mapper.toPreviousTrendPayload(kept).getResearchedAt());
    }

    private static TrendRepository.PreviousTrendView view(String name, LocalDateTime at, LocalDateTime deletedAt) {
        return new TrendRepository.PreviousTrendView() {
            public String getTrendName() { return name; }
            public LocalDateTime getResearchTime() { return at; }
            public LocalDateTime getDeletedAt() { return deletedAt; }
        };
    }
}
