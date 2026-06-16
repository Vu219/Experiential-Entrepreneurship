package com.aima.service.Impl;

import com.nimbusds.jose.JOSEException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.aima.dto.request.IntrospectRequest;
import com.aima.dto.request.LoginRequest;
import com.aima.dto.request.LogoutRequest;
import com.aima.dto.response.AuthenticationResponse;
import com.aima.dto.response.IntrospectResponse;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.UserRepository;
import com.aima.security.CookieUtils;
import com.aima.security.JwtProperties;
import com.aima.service.AuthenticationService;
import com.aima.service.JwtService;
import com.aima.service.RefreshTokenService;
import com.aima.service.TokenBlacklistService;

import java.security.SecureRandom;
import java.text.ParseException;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationServiceImpl implements AuthenticationService {
    UserRepository userRepository;
    PasswordEncoder passwordEncoder;
    TokenBlacklistService tokenBlacklistService;
    RefreshTokenService refreshTokenRedis;
    JwtService jwtService;
    JwtProperties jwtProperties;
    CookieUtils cookieUtils;

    static SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    public IntrospectResponse introspect(IntrospectRequest request) {
        try {
            var token = request.getToken();
            boolean isValid = true;

            try {
                jwtService.parseClaims(token);
            } catch (Exception e) {
                isValid = false;
            }

            return IntrospectResponse.builder()
                    .valid(isValid)
                    .build();
        } catch (Exception e) {
            log.error("Lỗi khi xác thực token", e);
            return IntrospectResponse.builder().valid(false).build();
        }
    }

    @Override
    @Transactional
    public void logout(LogoutRequest request, HttpServletRequest httpRequest, HttpServletResponse response)
            throws ParseException, JOSEException {
        // Thu hồi refresh token trong Redis + xoá cookie.
        cookieUtils.extractRefreshToken(httpRequest)
                .ifPresent(token -> {
                    try {
                        var claims = jwtService.parseClaims(token);
                        String jti = claims.getJWTID();
                        String email = claims.getSubject();
                        refreshTokenRedis.revoke(jti);
                        refreshTokenRedis.setLogoutTime(email);
                    } catch (Exception e) {
                        log.warn("Cannot parse refresh token for logout: {}", e.getMessage());
                    }
                });

        cookieUtils.clearRefreshTokenCookie(response);
        cookieUtils.clearAccessTokenCookie(response);

        // Nếu FE còn gửi kèm access token thì blacklist luôn.
        if (request != null && request.getToken() != null && !request.getToken().isBlank()) {
            try {
                var claims = jwtService.parseClaims(request.getToken());
                String jti = claims.getJWTID();
                Date expiryDate = claims.getExpirationTime();
                tokenBlacklistService.blacklist(jti, expiryDate);
            } catch (Exception e) {
                log.warn("Cannot blacklist access token during logout: {}", e.getMessage());
            }
        }
    }

    @Override
    @Transactional
    public AuthenticationResponse refreshToken(HttpServletRequest httpRequest, HttpServletResponse response) {
        String rawToken = cookieUtils.extractRefreshToken(httpRequest)
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

        try {
            var claims = jwtService.parseClaims(rawToken);
            String jti = claims.getJWTID();
            String typ = claims.getStringClaim("typ");

            if (!"refresh".equals(typ)) {
                throw new AppException(ErrorCode.UNAUTHENTICATED);
            }

            String userIdStr = refreshTokenRedis.getUserIdByJti(jti)
                    .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

            var user = userRepository.findById(UUID.fromString(userIdStr))
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

            if ("LOCKED".equalsIgnoreCase(user.getStatus())) {
                throw new AppException(ErrorCode.USER_INACTIVE);
            }

            // Rotate
            refreshTokenRedis.revoke(jti);

            String newJti = UUID.randomUUID().toString();
            var accessToken = jwtService.generateAccessToken(user);
            var refreshToken = jwtService.generateRefreshToken(user, newJti);

            refreshTokenRedis.store(newJti, user.getId().toString(),
                    java.time.Duration.ofSeconds(jwtProperties.refreshTokenExpiration()));

            cookieUtils.addAccessTokenCookie(response, accessToken);
            cookieUtils.addRefreshTokenCookie(response, refreshToken);

            return AuthenticationResponse.builder()
                    .token(accessToken)
                    .authenticated(true)
                    .build();
        } catch (Exception e) {
            log.error("Refresh token failed", e);
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
    }

    @Override
    public boolean isAccountLocked(String identifier) {
        var normalized = identifier == null ? "" : identifier.trim();
        var userOpt = userRepository.findByEmail(normalized);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(normalized);
        }
        return userOpt
                .map(user -> "LOCKED".equalsIgnoreCase(user.getStatus()))
                .orElse(false);
    }

    @Override
    @Transactional
    public AuthenticationResponse authenticate(LoginRequest request, HttpServletResponse response) {
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        boolean authenticated = passwordEncoder.matches(request.getPassword(), user.getPassword());

        if (!authenticated) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if ("LOCKED".equalsIgnoreCase(user.getStatus())) {
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        user.setLastActiveAt(LocalDateTime.now());
        userRepository.save(user);

        String jti = UUID.randomUUID().toString();
        var accessToken = jwtService.generateAccessToken(user);
        var refreshToken = jwtService.generateRefreshToken(user, jti);

        refreshTokenRedis.store(jti, user.getId().toString(),
                java.time.Duration.ofSeconds(jwtProperties.refreshTokenExpiration()));

        cookieUtils.addAccessTokenCookie(response, accessToken);
        cookieUtils.addRefreshTokenCookie(response, refreshToken);

        return AuthenticationResponse.builder()
                .token(accessToken)
                .authenticated(true)
                .build();
    }

    @Override
    @Transactional
    public AuthenticationResponse generateTokenForOAuth2User(User user) {
        if ("LOCKED".equalsIgnoreCase(user.getStatus())) {
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        user.setLastActiveAt(LocalDateTime.now());
        userRepository.save(user);

        String jti = UUID.randomUUID().toString();
        var accessToken = jwtService.generateAccessToken(user);
        var refreshToken = jwtService.generateRefreshToken(user, jti);

        refreshTokenRedis.store(jti, user.getId().toString(),
                java.time.Duration.ofSeconds(jwtProperties.refreshTokenExpiration()));

        return AuthenticationResponse.builder()
                .token(accessToken)
                .refreshToken(refreshToken)
                .authenticated(true)
                .build();
    }
}
