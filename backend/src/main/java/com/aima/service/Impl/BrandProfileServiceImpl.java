package com.aima.service.Impl;

import com.aima.config.storage.StorageBuckets;
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
import com.aima.service.StorageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

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
    StorageService storageService;

    // Logo nằm trong bucket private → trả về cho FE bằng signed URL (giống documents).
    private static final int LOGO_URL_TTL_SECONDS = 24 * 60 * 60; // 1 ngày

    @Override
    public ApiResponse<BrandProfileResponse> create(String email, BrandProfileRequest request) {
        User user = currentUser(email);

        BrandProfile profile = brandProfileMapper.toBrandProfile(request);
        profile.setUser(user);

        // Hồ sơ đầu tiên của user tự động là "Hồ sơ đang dùng" (isActive, tối đa 1/user) —
        // trước đây không gì set cờ này nên các tính năng cần active profile (FR-19) luôn fail.
        if (brandProfileRepository.findByUser_IdAndDeletedAtIsNull(user.getId()).isEmpty()) {
            profile.setIsActive(true);
        }

        if (StringUtils.hasText(request.getLogoUrl()) && request.getLogoUrl().startsWith("data:")) {
            String logoPath = storageService.uploadBase64BrandLogo(request.getLogoUrl(), user.getId().toString());
            profile.setLogoUrl(logoPath);
        }

        BrandProfile saved = brandProfileRepository.save(profile);

        return ApiResponse.success("Tạo hồ sơ thương hiệu thành công",
                withSignedLogo(brandProfileMapper.toBrandProfileResponse(saved)));
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<BrandProfileResponse>> list(String email) {
        List<BrandProfile> profiles = brandProfileRepository.findByUser_IdAndDeletedAtIsNull(currentUser(email).getId());

        List<BrandProfileResponse> responses = brandProfileMapper.toBrandProfileResponseList(profiles);
        responses.forEach(this::withSignedLogo);
        return ApiResponse.success("Lấy danh sách hồ sơ thương hiệu thành công", responses);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<BrandProfileResponse> get(String email, UUID id) {
        BrandProfile profile = find(currentUser(email).getId(), id);

        return ApiResponse.success("Lấy hồ sơ thương hiệu thành công",
                withSignedLogo(brandProfileMapper.toBrandProfileResponse(profile)));
    }

    @Override
    public ApiResponse<BrandProfileResponse> update(String email, UUID id, BrandProfileRequest request) {
        User user = currentUser(email);
        BrandProfile profile = find(user.getId(), id);

        String oldLogoUrl = profile.getLogoUrl();
        brandProfileMapper.updateBrandProfile(profile, request);

        if (StringUtils.hasText(request.getLogoUrl()) && request.getLogoUrl().startsWith("data:")) {
            deleteStorageFileIfPresent(oldLogoUrl);
            String logoPath = storageService.uploadBase64BrandLogo(request.getLogoUrl(), user.getId().toString());
            profile.setLogoUrl(logoPath);
        } else if (!StringUtils.hasText(request.getLogoUrl())) {
            deleteStorageFileIfPresent(oldLogoUrl);
            profile.setLogoUrl(null);
        }

        BrandProfile saved = brandProfileRepository.save(profile);

        return ApiResponse.success("Cập nhật hồ sơ thương hiệu thành công",
                withSignedLogo(brandProfileMapper.toBrandProfileResponse(saved)));
    }

    @Override
    public ApiResponse<Void> delete(String email, UUID id) {
        BrandProfile profile = find(currentUser(email).getId(), id);
        profile.setDeletedAt(LocalDateTime.now());
        brandProfileRepository.save(profile);
        return ApiResponse.success("Xóa hồ sơ thương hiệu thành công");
    }

    // Rule #24: không gọi I/O Supabase trong khi transaction DB còn mở → defer tới sau commit
    // (bỏ qua khi rollback). Giống UserServiceImpl.scheduleOldAvatarDeletion.
    private void deleteStorageFileIfPresent(String storedLogo) {
        if (!StringUtils.hasText(storedLogo)) return;
        String path = logoPath(storedLogo);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteLogoQuietly(path);
                }
            });
        } else {
            deleteLogoQuietly(path);
        }
    }

    private void deleteLogoQuietly(String path) {
        try {
            storageService.deleteFile(StorageBuckets.BRAND_LOGOS, path);
        } catch (Exception e) {
            log.warn("Không xóa được file logo cũ trên Supabase storage: {}", path, e);
        }
    }

    // logoUrl trong DB là PATH trong bucket private → đổi sang signed URL để FE hiển thị trực tiếp.
    private BrandProfileResponse withSignedLogo(BrandProfileResponse response) {
        String stored = response.getLogoUrl();
        if (!StringUtils.hasText(stored)) return response;
        String path = logoPath(stored);
        try {
            response.setLogoUrl(storageService.getSignedUrl(StorageBuckets.BRAND_LOGOS, path, LOGO_URL_TTL_SECONDS));
        } catch (Exception e) {
            log.warn("Không tạo được signed URL cho logo '{}'", path, e);
            response.setLogoUrl(null);
        }
        return response;
    }

    /**
     * Giá trị lưu trong DB bình thường là path thuần ({userId}/{uuid}_logo.png). Nếu là dữ liệu cũ
     * còn lưu full URL (public/sign), bóc lấy phần path sau "/{bucket}/" để vẫn xử lý được.
     */
    private String logoPath(String stored) {
        String marker = "/" + StorageBuckets.BRAND_LOGOS + "/";
        int idx = stored.indexOf(marker);
        if (idx < 0) return stored;
        String path = stored.substring(idx + marker.length());
        int q = path.indexOf('?'); // bỏ query token nếu là signed URL cũ
        return q >= 0 ? path.substring(0, q) : path;
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
