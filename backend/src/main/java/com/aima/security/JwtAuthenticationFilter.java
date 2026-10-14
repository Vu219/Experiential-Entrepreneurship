package com.aima.security;

import com.aima.exception.TokenExpiredException;
import com.aima.service.JwtService;
import com.aima.service.RefreshTokenService;
import com.aima.service.TokenBlacklistService;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;


import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    /** Thời điểm access token của request hết hạn ({@link java.time.Instant}) — luồng SSE tự đóng trước mốc này. */
    public static final String TOKEN_EXPIRES_AT_ATTRIBUTE = "aima.tokenExpiresAt";

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final RefreshTokenService refreshTokenRedis;
    private final CookieUtils cookieUtils;
    private final TokenBlacklistService tokenBlacklistService;

    @Qualifier("handlerExceptionResolver")
    private final HandlerExceptionResolver handlerExceptionResolver;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {

        String path = request.getServletPath();
        if (path.contains("/auth/refresh") || path.contains("/auth/login") || path.contains("/users/register")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = cookieUtils.extractAccessToken(request).orElse(null);

        // Bonus for fun (Swagger support)
        if (token == null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }

        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            JWTClaimsSet claims = jwtService.parseClaims(token);

            String typ = claims.getStringClaim("typ");
            if (!"access".equals(typ)) {
                filterChain.doFilter(request, response);
                return;
            }

            if (tokenBlacklistService.isBlacklisted(claims.getJWTID())) {
                log.warn("Token is blacklisted: {}", claims.getJWTID());
                cookieUtils.clearAccessTokenCookie(response);
                cookieUtils.clearRefreshTokenCookie(response);
                filterChain.doFilter(request, response);
                return;
            }

            String email = claims.getSubject();

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                Long logoutTime = refreshTokenRedis.getLogoutTime(email);
                long issuedAt = claims.getIssueTime().getTime();
                if (logoutTime != null && issuedAt < logoutTime) {
                    log.warn("Token has been revoked due to logout or password change for user: {}", email);
                    cookieUtils.clearAccessTokenCookie(response);
                    cookieUtils.clearRefreshTokenCookie(response);
                    filterChain.doFilter(request, response);
                    return;
                }

                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                if (userDetails.isEnabled()) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());

                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    request.setAttribute(TOKEN_EXPIRES_AT_ATTRIBUTE, claims.getExpirationTime().toInstant());
                }
            }
        } catch (TokenExpiredException e) {
            // Access token hết hạn = chưa đăng nhập (401 qua entry point), KHÔNG phải token hỏng: giữ cookie
            // refresh để FE gọi /auth/refresh rồi thử lại (xoá cả hai cookie ở đây làm user bị văng ra).
            log.debug("Access token expired: {}", request.getRequestURI());
            cookieUtils.clearAccessTokenCookie(response);
        } catch (Exception e) {
            log.error("Failed to authenticate JWT token: {}", e.getMessage());
            cookieUtils.clearAccessTokenCookie(response);
            cookieUtils.clearRefreshTokenCookie(response);
            handlerExceptionResolver.resolveException(request, response, null, e);
            return;
        }

        filterChain.doFilter(request, response);
    }
}
