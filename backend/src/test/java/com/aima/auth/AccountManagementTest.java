package com.aima.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for FR-01 (register), FR-02 (login), FR-03 (logout),
 * FR-04 (profile) against the unified response format (API-01).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AccountManagementTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerBody(String email) {
        return """
                {"fullName":"Nguyen Van A","email":"%s","password":"password123","confirmPassword":"password123"}
                """.formatted(email);
    }

    @Test
    void registerSucceedsWithValidInput() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("register-ok@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.result.email").value("register-ok@example.com"))
                .andExpect(jsonPath("$.result.fullName").value("Nguyen Van A"))
                .andExpect(jsonPath("$.result.role").value("USER"));
    }

    @Test
    void registerRejectsPasswordMismatch() throws Exception {
        String body = """
                {"fullName":"Nguyen Van A","email":"mismatch@example.com","password":"password123","confirmPassword":"different456"}
                """;
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("Password confirmation does not match"));
    }

    @Test
    void registerRejectsDuplicateEmail() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("duplicate@example.com")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("duplicate@example.com")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    void registerRejectsInvalidEmail() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("not-an-email")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void loginReturnsTokenAndUser() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("login-ok@example.com")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("""
                                {"email":"login-ok@example.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.token").isNotEmpty())
                .andExpect(jsonPath("$.result.user.email").value("login-ok@example.com"));
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("login-bad@example.com")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("""
                                {"email":"login-bad@example.com","password":"wrongpassword"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void profileRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void profileCanBeViewedAndUpdated() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(APPLICATION_JSON)
                        .content(registerBody("profile@example.com")))
                .andExpect(status().isOk());

        MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("""
                                {"email":"profile@example.com","password":"password123"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(login.getResponse().getContentAsString());
        String token = json.at("/result/token").asText();

        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.email").value("profile@example.com"));

        mockMvc.perform(put("/api/users/me").header("Authorization", "Bearer " + token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"fullName":"Tran Thi B"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.fullName").value("Tran Thi B"));
    }

    @Test
    void logoutSucceeds() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
