package com.aima.user;

import com.aima.common.ApiResponse;
import com.aima.user.dto.UpdateProfileRequest;
import com.aima.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // FR-04: view personal information
    @GetMapping("/me")
    public ApiResponse<UserResponse> getProfile(@AuthenticationPrincipal User user) {
        return ApiResponse.success(UserResponse.from(user));
    }

    // FR-04: update personal information
    @PutMapping("/me")
    public ApiResponse<UserResponse> updateProfile(@AuthenticationPrincipal User user,
                                                   @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.success("Profile updated", userService.updateProfile(user.getId(), request));
    }
}
