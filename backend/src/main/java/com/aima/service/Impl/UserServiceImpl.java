package com.aima.service.Impl;

import com.aima.dto.response.MeResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.UserResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UserMapper;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.UserService;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class UserServiceImpl implements UserService {
    UserRepository userRepository;
    RoleRepository roleRepository;

    UserMapper userMapper;

    PasswordEncoder passwordEncoder;

    @Override
    public ApiResponse<UserResponse> registerUser(UserRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail()))
            throw new AppException(ErrorCode.EMAIL_EXISTED);

        User user = userMapper.toUser(request);
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        Role role = roleRepository.findByRoleName("USER")
                .orElseThrow(() -> new AppException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));
        user.setRole(role);

        user.setStatus("ACTIVE");
        User savedUser = userRepository.save(user);

        UserResponse userResponse = userMapper.toUserResponse(savedUser);
//        resolveAvatar(userResponse);
        return ApiResponse.success("Đăng ký tài khoản thành công", userResponse);
    }

    @Override
    public ApiResponse<List<UserResponse>> getAllUsers() {
        List<User> users = userRepository.findAll();

        if (users.isEmpty()) {
            throw new AppException(ErrorCode.USER_LIST_EMPTY);
        }

        List<UserResponse> userResponses = userMapper.toUserResponseList(users);
//        resolveAvatar(userResponses);
        return ApiResponse.success("Lấy danh sách người dùng thành công", userResponses);
    }

    @Override
    public ApiResponse<UserResponse> getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        UserResponse userResponse = userMapper.toUserResponse(user);
//        resolveAvatar(userResponse);
        return ApiResponse.success("Lấy thông tin Người dùng thành công", userResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<MeResponse> getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        MeResponse meResponse = userMapper.toMeResponse(user);

        return ApiResponse.success("Lấy thông tin người dùng hiện tại thành công", meResponse);
    }
}
