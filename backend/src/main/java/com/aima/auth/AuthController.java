package com.aima.auth;

import com.aima.auth.dto.AuthResponse;
import com.aima.auth.dto.LoginRequest;
import com.aima.auth.dto.RegisterRequest;
import com.aima.common.ApiResponse;
import com.aima.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success("Registration successful", authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success("Login successful", authService.login(request));
    }

    // FR-03: JWTs are stateless — logout is acknowledged server-side and the
    // client discards its token
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        return ApiResponse.success("Logout successful", null);
    }
}
