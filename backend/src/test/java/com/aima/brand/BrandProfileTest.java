package com.aima.brand;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for FR-05 (create), FR-06 (update), FR-07 (view/list),
 * FR-08 (delete) and FR-09 (validation) of Brand Profile.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BrandProfileTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String validBody() {
        return """
                {
                  "brandName": "Acme Cosmetics",
                  "industry": "Cosmetics",
                  "description": "Clean beauty for everyone",
                  "brandVoice": "Friendly and confident",
                  "targetAudience": "Women 18-35",
                  "contentGoal": "Brand awareness",
                  "platforms": ["FACEBOOK", "INSTAGRAM"],
                  "brandKeywords": ["clean beauty", "skincare"],
                  "brandDos": ["Be authentic"],
                  "brandDonts": ["Hard selling"]
                }
                """;
    }

    /** Registers a fresh user and returns a JWT for it. */
    private String authToken(String email) throws Exception {
        String register = """
                {"fullName":"Owner","email":"%s","password":"password123","confirmPassword":"password123"}
                """.formatted(email);
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON).content(register))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).at("/result/token").asText();
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/brand-profiles"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void createsAndListsBrandProfile() throws Exception {
        String token = authToken("brand-create@example.com");

        mockMvc.perform(post("/api/brand-profiles").header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.result.brandName").value("Acme Cosmetics"))
                .andExpect(jsonPath("$.result.platforms.length()").value(2))
                .andExpect(jsonPath("$.result.brandKeywords.length()").value(2));

        // List trả PageResponse (phân trang server-side): bản ghi nằm trong result.content.
        mockMvc.perform(get("/api/brand-profiles").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.content.length()").value(1))
                .andExpect(jsonPath("$.result.totalElements").value(1));
    }

    @Test
    void rejectsMissingRequiredFields() throws Exception {
        String token = authToken("brand-validate@example.com");
        String body = """
                {"brandName":"","industry":"Cosmetics","targetAudience":"Women",
                 "platforms":["FACEBOOK"]}
                """;
        mockMvc.perform(post("/api/brand-profiles").header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void rejectsEmptyPlatformList() throws Exception {
        String token = authToken("brand-platform@example.com");
        String body = """
                {"brandName":"Acme","industry":"Cosmetics","targetAudience":"Women",
                 "platforms":[]}
                """;
        mockMvc.perform(post("/api/brand-profiles").header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("platforms: Select at least one platform"));
    }

    @Test
    void updatesViewsAndDeletes() throws Exception {
        String token = authToken("brand-crud@example.com");

        MvcResult created = mockMvc.perform(post("/api/brand-profiles").header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString()).at("/result/id").asText();

        String updated = validBody().replace("Acme Cosmetics", "Acme Beauty");
        mockMvc.perform(put("/api/brand-profiles/" + id).header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON).content(updated))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.brandName").value("Acme Beauty"));

        mockMvc.perform(get("/api/brand-profiles/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.brandName").value("Acme Beauty"));

        mockMvc.perform(delete("/api/brand-profiles/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/brand-profiles/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void cannotAccessAnotherUsersProfile() throws Exception {
        String owner = authToken("brand-owner@example.com");
        String other = authToken("brand-other@example.com");

        MvcResult created = mockMvc.perform(post("/api/brand-profiles").header("Authorization", "Bearer " + owner)
                        .contentType(APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString()).at("/result/id").asText();

        mockMvc.perform(get("/api/brand-profiles/" + id).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
    }
}
