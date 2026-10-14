package com.aima.auth;

import com.aima.exception.TokenExpiredException;
import com.aima.security.CookieUtils;
import com.aima.security.JwtAuthenticationFilter;
import com.aima.service.JwtService;
import com.aima.service.RefreshTokenService;
import com.aima.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.servlet.HandlerExceptionResolver;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Bước 0 (refresh token): access token HẾT HẠN phải thành 401 "chưa đăng nhập" và giữ nguyên cookie refresh —
 * trước đây filter xoá cả hai cookie + trả 500, nên request rơi đúng lúc token hết hạn làm user bị văng ra.
 */
class JwtAuthenticationFilterExpiryTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final CookieUtils cookieUtils = mock(CookieUtils.class);
    private final HandlerExceptionResolver resolver = mock(HandlerExceptionResolver.class);
    private final FilterChain chain = mock(FilterChain.class);
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtService, mock(UserDetailsService.class), mock(RefreshTokenService.class),
                cookieUtils, mock(TokenBlacklistService.class), resolver);
        when(cookieUtils.extractAccessToken(any())).thenReturn(Optional.of("expired.jwt.token"));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void expiredAccessToken_clearsOnlyAccessCookie_andContinuesUnauthenticated() throws Exception {
        when(jwtService.parseClaims(anyString())).thenThrow(new TokenExpiredException());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/notifications");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(cookieUtils).clearAccessTokenCookie(response);
        verify(cookieUtils, never()).clearRefreshTokenCookie(any());
        verify(resolver, never()).resolveException(any(), any(), any(), any());
        verify(chain).doFilter(request, response); // entry point trả 401 → FE gọi /auth/refresh
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void tamperedToken_keepsOldBehaviour_clearsBothCookies() throws Exception {
        when(jwtService.parseClaims(anyString())).thenThrow(new RuntimeException("Invalid token signature"));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/notifications");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(cookieUtils).clearAccessTokenCookie(response);
        verify(cookieUtils).clearRefreshTokenCookie(response);
        verify(chain, never()).doFilter(any(), any());
    }
}
