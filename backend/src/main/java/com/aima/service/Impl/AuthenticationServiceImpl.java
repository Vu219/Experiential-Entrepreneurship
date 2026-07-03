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
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.AuthenticationResponse;
import com.aima.dto.response.IntrospectResponse;
import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.AuthenticationMapper;
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
import java.util.LinkedHashMap;
import java.util.Map;
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
    AuthenticationMapper authenticationMapper;

    static SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    public ApiResponse<IntrospectResponse> introspect(IntrospectRequest request) {
        boolean isValid = true;
        try {
            jwtService.parseClaims(request.getToken());
        } catch (Exception e) {
            isValid = false;
        }

        IntrospectResponse introspectResponse = IntrospectResponse.builder().valid(isValid).build();
        return ApiResponse.success("Introspect token thành công", introspectResponse);
    }

    @Override
    @Transactional
    public ApiResponse<Void> logout(LogoutRequest request, HttpServletRequest httpRequest, HttpServletResponse response)
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

        return ApiResponse.success("Đăng xuất thành công");
    }

    @Override
    @Transactional
    public ApiResponse<AuthenticationResponse> refreshToken(HttpServletRequest httpRequest, HttpServletResponse response) {
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

            if (user.getStatus() == UserStatus.LOCKED) {
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

            AuthenticationResponse authResponse = authenticationMapper.toAuthResponse(accessToken);
            return ApiResponse.success("Làm mới token thành công", authResponse);
        } catch (AppException e) {
            // Lỗi nghiệp vụ đã xác định (vd USER_INACTIVE) -> giữ nguyên mã lỗi gốc.
            throw e;
        } catch (Exception e) {
            // Token hỏng/không parse được -> coi như chưa xác thực.
            log.warn("Refresh token không hợp lệ: {}", e.getMessage());
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
    }

    @Override
    public ApiResponse<Map<String, Object>> accountStatus(String identifier) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("LOCKED", isAccountLocked(identifier));

        return ApiResponse.<Map<String, Object>>builder()
                .result(result)
                .build();
    }

    private boolean isAccountLocked(String identifier) {
        var normalized = identifier == null ? "" : identifier.trim();
        var userOpt = userRepository.findByEmail(normalized);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(normalized);
        }
        return userOpt
                .map(user -> user.getStatus() == UserStatus.LOCKED)
                .orElse(false);
    }

    @Override
    @Transactional
    public ApiResponse<AuthenticationResponse> authenticate(LoginRequest request, HttpServletResponse response) {
        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        boolean authenticated = passwordEncoder.matches(request.getPassword(), user.getPassword());

        if (!authenticated) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (user.getStatus() == UserStatus.LOCKED) {
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

        AuthenticationResponse authResponse = authenticationMapper.toAuthResponse(accessToken);
        return ApiResponse.success("Đăng nhập thành công", authResponse);
    }

    @Override
    @Transactional
    public AuthenticationResponse generateTokenForOAuth2User(User user) {
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        user.setLastActiveAt(LocalDateTime.now());
        userRepository.save(user);

        String jti = UUID.randomUUID().toString();
        var accessToken = jwtService.generateAccessToken(user);
        var refreshToken = jwtService.generateRefreshToken(user, jti);

        refreshTokenRedis.store(jti, user.getId().toString(),
                java.time.Duration.ofSeconds(jwtProperties.refreshTokenExpiration()));

        return authenticationMapper.toAuthResponse(accessToken, refreshToken);
    }
}
