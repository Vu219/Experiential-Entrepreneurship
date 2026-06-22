package com.aima.service;

import com.aima.dto.request.IntrospectRequest;
import com.aima.dto.request.LoginRequest;
import com.aima.dto.request.LogoutRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthenticationResponse;
import com.aima.dto.response.IntrospectResponse;
import com.aima.entity.User;
import com.nimbusds.jose.JOSEException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.text.ParseException;
import java.util.Map;

public interface AuthenticationService {
    ApiResponse<AuthenticationResponse> authenticate(LoginRequest request, HttpServletResponse response);
    ApiResponse<IntrospectResponse> introspect(IntrospectRequest request);
    ApiResponse<Void> logout(LogoutRequest request, HttpServletRequest httpRequest, HttpServletResponse response)
            throws ParseException, JOSEException;
    ApiResponse<AuthenticationResponse> refreshToken(HttpServletRequest httpRequest, HttpServletResponse response);
    AuthenticationResponse generateTokenForOAuth2User(User user);
    ApiResponse<Map<String, Object>> accountStatus(String identifier);
}
