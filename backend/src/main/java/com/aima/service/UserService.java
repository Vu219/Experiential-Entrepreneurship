package com.aima.service;



import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.MeResponse;
import com.aima.dto.response.UserResponse;

import java.util.List;
import java.util.UUID;

public interface UserService {
    ApiResponse<UserResponse> registerUser(UserRegisterRequest request);
    ApiResponse<List<UserResponse>> getAllUsers();
    ApiResponse<UserResponse> getUserById(UUID userId);
    ApiResponse<MeResponse> getCurrentUser(String email);
}
