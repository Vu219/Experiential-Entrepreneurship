package com.aima.user.dto;

import com.aima.user.User;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String fullName, String email, String role, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                user.getCreatedAt());
    }
}
