package com.aima.service.Impl;

import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BrandProfileResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.BrandProfileMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.UserRepository;
import com.aima.service.BrandProfileService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class BrandProfileServiceImpl implements BrandProfileService {

    BrandProfileRepository brandProfileRepository;
    UserRepository userRepository;
    BrandProfileMapper brandProfileMapper;

    // FR-05: create a brand profile owned by the current user
    @Override
    public ApiResponse<BrandProfileResponse> create(String email, BrandProfileRequest request) {
        User user = currentUser(email);

        BrandProfile profile = brandProfileMapper.toBrandProfile(request);
        profile.setUser(user);
        BrandProfile saved = brandProfileRepository.save(profile);

        return ApiResponse.success("Tạo hồ sơ thương hiệu thành công",
                brandProfileMapper.toBrandProfileResponse(saved));
    }

    // FR-07: list the current user's brand profiles
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<BrandProfileResponse>> list(String email) {
        List<BrandProfile> profiles = brandProfileRepository.findByUser_IdAndDeletedAtIsNull(currentUser(email).getId());

        return ApiResponse.success("Lấy danh sách hồ sơ thương hiệu thành công",
                brandProfileMapper.toBrandProfileResponseList(profiles));
    }

    // FR-07: view a single brand profile
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<BrandProfileResponse> get(String email, UUID id) {
        BrandProfile profile = find(currentUser(email).getId(), id);

        return ApiResponse.success("Lấy hồ sơ thương hiệu thành công",
                brandProfileMapper.toBrandProfileResponse(profile));
    }

    // FR-06: update a brand profile
    @Override
    public ApiResponse<BrandProfileResponse> update(String email, UUID id, BrandProfileRequest request) {
        BrandProfile profile = find(currentUser(email).getId(), id);

        brandProfileMapper.updateBrandProfile(profile, request);
        BrandProfile saved = brandProfileRepository.save(profile);

        return ApiResponse.success("Cập nhật hồ sơ thương hiệu thành công",
                brandProfileMapper.toBrandProfileResponse(saved));
    }

    // FR-08: soft delete a brand profile
    @Override
    public ApiResponse<Void> delete(String email, UUID id) {
        BrandProfile profile = find(currentUser(email).getId(), id);
        profile.setDeletedAt(LocalDateTime.now());
        brandProfileRepository.save(profile);
        return ApiResponse.success("Xóa hồ sơ thương hiệu thành công");
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    private BrandProfile find(UUID userId, UUID id) {
        return brandProfileRepository.findByIdAndUser_IdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.BRAND_PROFILE_NOT_FOUND));
    }
}
