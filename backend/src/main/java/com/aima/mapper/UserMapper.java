package com.aima.mapper;

import com.aima.dto.response.MeResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.UserResponse;
import com.aima.entity.User;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(target = "username", source = "email")
    User toUser(UserRegisterRequest request);

    @Mapping(target = "role", source = "role")
    @Mapping(target = "createdAt", source = "createdAt")
//    @Mapping(target = "avatarUrl", source = "avatarUrl")
    UserResponse toUserResponse(User user);

    List<UserResponse> toUserResponseList(List<User> users);

    @Mapping(target = "role", source = "role.roleName")
    MeResponse toMeResponse(User user);
}
