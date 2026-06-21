package com.aima.security;

import com.aima.service.SupabaseStorageService;
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
import com.aima.enums.UserStatus;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AuthenticationService;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    UserRepository userRepository;
    RoleRepository roleRepository;
    AuthenticationService authenticationService;
    CookieUtils cookieUtils;
    PasswordEncoder passwordEncoder;
    SupabaseStorageService supabaseStorageService;

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

            syncGoogleAvatar(user, fPicture);

            var authResponse = authenticationService.generateTokenForOAuth2User(user);

            clearAuthenticationAttributes(request);

            // Đặt cả access token và refresh token vào cookie HttpOnly.
            // Không đưa token vào URL: tránh rò rỉ qua history/Referer/access log (SEC-03, NFR-06).
            cookieUtils.addAccessTokenCookie(response, authResponse.getToken());
            cookieUtils.addRefreshTokenCookie(response, authResponse.getRefreshToken());

            String redirectUrl = frontendCallbackUrl + "?login=success";
            getRedirectStrategy().sendRedirect(request, response, redirectUrl);

        } catch (Exception e) {
            log.error("Lỗi khi xử lý OAuth2 authentication success", e);
            String errorMsg = URLEncoder.encode("Đăng nhập Google thất bại. Vui lòng thử lại.", StandardCharsets.UTF_8);
            getRedirectStrategy().sendRedirect(request, response, frontendCallbackUrl + "?error=" + errorMsg);
        }
    }

    private void syncGoogleAvatar(User user, String googlePictureUrl) {
        if (googlePictureUrl == null) return;

        String current = user.getAvatarUrl();
        boolean shouldMirror = current == null || current.contains("googleusercontent.com");
        if (!shouldMirror) return;

        try {
            String supabaseUrl = supabaseStorageService.uploadAvatarFromUrl(googlePictureUrl, user.getId().toString());
            user.setAvatarUrl(supabaseUrl);
            userRepository.save(user);
            log.info("Đã đồng bộ avatar Google sang Supabase cho {}", user.getEmail());
        } catch (Exception e) {
            log.warn("Không thể đồng bộ avatar Google sang Supabase cho {}: {}", user.getEmail(), e.getMessage());
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

        // Mật khẩu ngẫu nhiên đã được hash: user Google không dùng mật khẩu để đăng nhập,
        // nhưng cột password vẫn cần một giá trị an toàn (không phải chuỗi cố định/đoán được).
        String randomPassword = passwordEncoder.encode(UUID.randomUUID().toString());

        User newUser = User.builder()
                .username(username)
                .email(email)
                .password(randomPassword)
                .phone("GOOGLE_OAUTH2_USER")
                .fullName(name != null ? name : baseUsername)
                .googleId(googleId)
                .provider("GOOGLE")
                .avatarUrl(picture)
                .status(UserStatus.ACTIVE)
                .role(role)
                .build();

        log.info("Tạo user mới từ Google OAuth2: {}", email);
        return userRepository.save(newUser);
    }
}
