package com.aima.auth.dto;

import com.aima.user.dto.UserResponse;

public record AuthResponse(String token, UserResponse user) {
}
