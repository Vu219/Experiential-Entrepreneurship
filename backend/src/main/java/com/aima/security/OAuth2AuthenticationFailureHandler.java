package com.aima.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class OAuth2AuthenticationFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${app.oauth2.frontend-callback-url}")
    private String frontendCallbackUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        log.error("OAuth2 đăng nhập thất bại: {}", exception.getMessage());

        String errorMsg = URLEncoder.encode(
                exception.getMessage() != null ? exception.getMessage() : "Đăng nhập Google thất bại",
                StandardCharsets.UTF_8
        );

        getRedirectStrategy().sendRedirect(request, response, frontendCallbackUrl + "?error=" + errorMsg);
    }
}
