package com.aima.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AuthenticationService;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    UserRepository userRepository;
    RoleRepository roleRepository;
    AuthenticationService authenticationService;
    CookieUtils cookieUtils;

    @NonFinal
    @Value("${app.oauth2.frontend-callback-url}")
    String frontendCallbackUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        try {
            OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

            String email, googleId, name, picture;
            if (oAuth2User instanceof OidcUser oidcUser) {
                email    = oidcUser.getEmail();
                googleId = oidcUser.getSubject();
                name     = oidcUser.getFullName();
                picture  = oidcUser.getPicture();
            } else {
                email    = oAuth2User.getAttribute("email");
                googleId = oAuth2User.getAttribute("sub");
                name     = oAuth2User.getAttribute("name");
                picture  = oAuth2User.getAttribute("picture");
            }

            final String fEmail    = email;
            final String fGoogleId = googleId;
            final String fName     = name;
            final String fPicture  = picture;

            var user = userRepository.findByEmail(email)
                    .map(existing -> updateIfNeeded(existing, fGoogleId, fPicture))
                    .orElseGet(() -> createGoogleUser(fEmail, fGoogleId, fName, fPicture));

            var authResponse = authenticationService.generateTokenForOAuth2User(user);

            clearAuthenticationAttributes(request);

            // Đặt cả access token và refresh token vào cookie HttpOnly
            cookieUtils.addAccessTokenCookie(response, authResponse.getToken());
            cookieUtils.addRefreshTokenCookie(response, authResponse.getRefreshToken());

            String redirectUrl = frontendCallbackUrl + "?login=success" + "&access_token=" + authResponse.getToken()
                    + "&refresh_token=" + authResponse.getRefreshToken();
            getRedirectStrategy().sendRedirect(request, response, redirectUrl);

        } catch (Exception e) {
            log.error("Lỗi khi xử lý OAuth2 authentication success", e);
            String errorMsg = URLEncoder.encode("Đăng nhập Google thất bại. Vui lòng thử lại.", StandardCharsets.UTF_8);
            getRedirectStrategy().sendRedirect(request, response, frontendCallbackUrl + "?error=" + errorMsg);
        }
    }

    private User updateIfNeeded(User user, String googleId, String picture) {
        boolean updated = false;
        if (user.getGoogleId() == null) {
            user.setGoogleId(googleId);
            updated = true;
        }
        if (!"GOOGLE".equals(user.getProvider())) {
            user.setProvider("GOOGLE");
            updated = true;
        }
        if (picture != null && user.getAvatarUrl() == null) {
            user.setAvatarUrl(picture);
            updated = true;
        }
        return updated ? userRepository.save(user) : user;
    }

    private User createGoogleUser(String email, String googleId, String name, String picture) {
        Role role = roleRepository.findByRoleName("USER")
                .orElseGet(() -> roleRepository.save(
                        Role.builder().roleName("USER").description("Người dùng thông thường").build()
                ));

        String baseUsername = email.split("@")[0];
        String username = userRepository.existsByUsername(baseUsername)
                ? baseUsername + "_" + googleId.substring(0, 6)
                : baseUsername;

        User newUser = User.builder()
                .username(username)
                .email(email)
                .password("GOOGLE_OAUTH2_USER")
                .phone("GOOGLE_OAUTH2_USER")
                .fullName(name != null ? name : baseUsername)
                .googleId(googleId)
                .provider("GOOGLE")
                .avatarUrl(picture)
                .status("ACTIVE")
                .role(role)
                .build();

        log.info("Tạo user mới từ Google OAuth2: {}", email);
        return userRepository.save(newUser);
    }
}
