package com.aima.mapper;

import com.aima.dto.request.CompleteProfileRequest;
import com.aima.dto.response.DeleteAccountResponse;
import com.aima.dto.response.MeResponse;
import com.aima.dto.response.ProfileStatsResponse;
import com.aima.dto.response.TokenUsageResponse;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import com.aima.dto.request.AdminCreateUserRequest;
import com.aima.dto.request.AdminUpdateUserRequest;
import com.aima.dto.request.UpdateProfileRequest;
import com.aima.dto.request.UserRegisterRequest;
import com.aima.dto.response.UserResponse;
import com.aima.entity.User;

import java.time.LocalDateTime;
import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(target = "username", source = "email")
    User toUser(UserRegisterRequest request);

    // Admin tạo user: username = email; password/role/status do service set (role là String → Role nên ignore).
    @Mapping(target = "username", source = "email")
    @Mapping(target = "role", ignore = true)
    User toUser(AdminCreateUserRequest request);

    // provider null (user Email thường) → "EMAIL"; plan null → "FREE".
    // connectedChannels do service set riêng ở GET /users/{id} (không có trên entity).
    @Mapping(target = "plan", expression = "java(user.getPlan() != null ? user.getPlan().name() : \"FREE\")")
    @Mapping(target = "provider", expression = "java(\"GOOGLE\".equalsIgnoreCase(user.getProvider()) ? \"GOOGLE\" : \"EMAIL\")")
    @Mapping(target = "connectedChannels", ignore = true)
    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);

    @Mapping(target = "role", source = "role.roleName")
    MeResponse toMeResponse(User user);

    @Mapping(target = "password", ignore = true)
    @Mapping(target = "dateOfBirth", source = "dob")
    void completeProfile(CompleteProfileRequest request, @MappingTarget User user);


    // Cập nhật hồ sơ: chỉ ghi đè các trường có giá trị (bỏ qua null).
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateProfile(UpdateProfileRequest request, @MappingTarget User user);

    // Admin cập nhật (partial): map fullName/email/phone/avatarUrl/plan/status (bỏ qua null);
    // role do service tra cứu entity nên ignore ở đây.
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "role", ignore = true)
    void updateByAdmin(AdminUpdateUserRequest request, @MappingTarget User user);

    DeleteAccountResponse toDeleteAccountResponse(User user, Long daysRemaining, String message);

    // Hai ô số card hồ sơ — tên tham số trùng tên property đích nên MapStruct tự khớp.
    // Tham số phải BOXED: toàn tham số nguyên thủy thì MapStruct sinh ra `if (  )` rỗng (không có
    // nguồn nào để null-check) và file sinh ra không biên dịch được.
    ProfileStatsResponse toProfileStatsResponse(Long postsPublished, Long totalReach);

    // used/limit khớp tên tham số; plan lấy từ user (null → FREE, cùng quy ước toResponse).
    @Mapping(target = "plan", expression = "java(user.getPlan() != null ? user.getPlan().name() : \"FREE\")")
    TokenUsageResponse toTokenUsageResponse(User user, Long used, Long limit, Long creditLeft,
                                            String effectivePlanForQuota, LocalDateTime pendingPlanChangeAt);
}
