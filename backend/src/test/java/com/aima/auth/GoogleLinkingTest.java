package com.aima.auth;

import com.aima.dto.response.AuthenticationResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.UserStatus;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.security.CookieUtils;
import com.aima.security.OAuth2AuthenticationSuccessHandler;
import com.aima.service.AuthenticationService;
import com.aima.service.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Google ở /login và /register: liên kết vào tài khoản có sẵn (giữ provider), tạo mới chữ thường. */
class GoogleLinkingTest {

    private static final String CALLBACK = "http://localhost:3000/auth/google/callback";

    private UserRepository userRepository;
    private OAuth2AuthenticationSuccessHandler handler;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        RoleRepository roleRepository = mock(RoleRepository.class);
        when(roleRepository.findByRoleName("USER")).thenReturn(Optional.of(Role.builder().roleName("USER").build()));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(UUID.randomUUID());
            return u;
        });
        AuthenticationService authenticationService = mock(AuthenticationService.class);
        when(authenticationService.generateTokenForOAuth2User(any()))
                .thenReturn(AuthenticationResponse.builder().token("a").refreshToken("r").build());

        handler = new OAuth2AuthenticationSuccessHandler(userRepository, roleRepository, authenticationService,
                mock(CookieUtils.class), new BCryptPasswordEncoder(4), mock(StorageService.class));
        ReflectionTestUtils.setField(handler, "frontendCallbackUrl", CALLBACK);
    }

    private String login(String googleEmail) throws Exception {
        var principal = new DefaultOAuth2User(List.of(), Map.of(
                "sub", "google-sub-123456", "email", googleEmail, "name", "Google Name"), "sub");
        var response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, new TestingAuthenticationToken(principal, null));
        return response.getRedirectedUrl();
    }

    @Test
    void existingEmailPasswordAccount_isLinked_keepsProvider_andFlagsLinked() throws Exception {
        User local = User.builder().email("an@gmail.com").username("an@gmail.com").fullName("An")
                .password("hash").status(UserStatus.ACTIVE).build();
        local.setId(UUID.randomUUID());
        when(userRepository.findFirstByEmailIgnoreCaseOrderByCreatedAtAsc("an@gmail.com")).thenReturn(Optional.of(local));

        String url = login("An@Gmail.com");

        assertEquals(CALLBACK + "?login=success&linked=1", url);
        assertEquals("google-sub-123456", local.getGoogleId());
        assertNull(local.getProvider(), "provider cũ phải giữ nguyên, không ghi đè thành GOOGLE");
        assertEquals("hash", local.getPassword());
    }

    @Test
    void alreadyLinkedAccount_noLinkedFlag() throws Exception {
        User linked = User.builder().email("an@gmail.com").username("an").fullName("An")
                .googleId("google-sub-123456").status(UserStatus.ACTIVE).build();
        linked.setId(UUID.randomUUID());
        when(userRepository.findFirstByEmailIgnoreCaseOrderByCreatedAtAsc("an@gmail.com")).thenReturn(Optional.of(linked));

        assertEquals(CALLBACK + "?login=success", login("an@gmail.com"));
    }

    @Test
    void newEmail_createsSingleGoogleAccount_lowercased() throws Exception {
        when(userRepository.findFirstByEmailIgnoreCaseOrderByCreatedAtAsc(any())).thenReturn(Optional.empty());

        assertEquals(CALLBACK + "?login=success", login("New.User@Gmail.com"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals("new.user@gmail.com", saved.getValue().getEmail());
        assertEquals("GOOGLE", saved.getValue().getProvider());
    }
}
