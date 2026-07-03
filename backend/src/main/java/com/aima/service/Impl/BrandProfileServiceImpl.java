package com.aima.service.Impl;

import com.aima.config.storage.StorageBuckets;
import com.aima.dto.request.BrandProfileRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.BrandProfileResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.BrandProfileMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.BrandProfileService;
import com.aima.service.StorageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class BrandProfileServiceImpl implements BrandProfileService {

    BrandProfileRepository brandProfileRepository;
    ContentStrategyRepository contentStrategyRepository;
    UserRepository userRepository;
    BrandProfileMapper brandProfileMapper;
    StorageService storageService;
    TransactionTemplate transactionTemplate;

    // Logo nằm trong bucket private → trả về cho FE bằng signed URL (giống documents).
    private static final int LOGO_URL_TTL_SECONDS = 24 * 60 * 60; // 1 ngày

    @Override
    public ApiResponse<BrandProfileResponse> create(String email, BrandProfileRequest request) {
        User user = currentUser(email);

        // Upload logo (HTTP Supabase) TRƯỚC khi mở transaction (rule #24).
        String uploadedPath = null;
        if (StringUtils.hasText(request.getLogoUrl()) && request.getLogoUrl().startsWith("data:")) {
            uploadedPath = storageService.uploadBase64BrandLogo(request.getLogoUrl(), user.getId().toString());
        }
        final String logoPath = uploadedPath;

        BrandProfileResponse response;
        try {
            response = transactionTemplate.execute(tx -> {
                BrandProfile profile = brandProfileMapper.toBrandProfile(request);
                profile.setUser(user);

                // Hồ sơ đầu tiên của user tự động là "Hồ sơ đang dùng" (isActive, tối đa 1/user) —
                // trước đây không gì set cờ này nên các tính năng cần active profile (FR-19) luôn fail.
                if (brandProfileRepository.findByUser_IdAndDeletedAtIsNull(user.getId()).isEmpty()) {
                    profile.setIsActive(true);
                }
                if (logoPath != null) {
                    profile.setLogoUrl(logoPath);
                }
                return brandProfileMapper.toBrandProfileResponse(brandProfileRepository.save(profile));
            });
        } catch (RuntimeException e) {
            // DB fail sau khi đã upload → dọn file vừa upload để không rác storage.
            if (logoPath != null) deleteLogoQuietly(logoPath);
            throw e;
        }

        return ApiResponse.success("Tạo hồ sơ thương hiệu thành công", withSignedLogo(response));
    }

    // Phân trang + lọc server-side (PageResponse dùng chung, cùng mẫu UserServiceImpl.getAllUsers).
    @Override
    public ApiResponse<PageResponse<BrandProfileResponse>> list(String email, String q, String industry, Pageable pageable) {
        User user = currentUser(email);
        String query = q == null ? "" : q.trim();
        String industryFilter = industry == null ? "" : industry.trim();

        PageResponse<BrandProfileResponse> result = transactionTemplate.execute(tx -> {
            Page<BrandProfile> page = brandProfileRepository.search(user.getId(), query, industryFilter, pageable);
            List<BrandProfileResponse> responses = brandProfileMapper.toBrandProfileResponseList(page.getContent());
            // Badge "N chiến lược" trên card — đếm tại DB thay vì FE tải toàn bộ chiến lược.
            responses.forEach(r -> r.setStrategyCount(
                    contentStrategyRepository.countByBrandProfile_IdAndDeletedAtIsNull(r.getId())));
            return PageResponse.from(page, responses);
        });

        // Sign URL logo (HTTP Supabase) SAU khi transaction đã đóng (rule #24).
        result.getContent().forEach(this::withSignedLogo);
        return ApiResponse.success("Lấy danh sách hồ sơ thương hiệu thành công", result);
    }

    // Dropdown lọc ngành hàng cần toàn bộ ngành của user (không phụ thuộc trang hiện tại).
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<String>> listIndustries(String email) {
        return ApiResponse.success("Lấy danh sách ngành hàng thành công",
                brandProfileRepository.findDistinctIndustriesByUserId(currentUser(email).getId()));
    }

    @Override
    public ApiResponse<BrandProfileResponse> get(String email, UUID id) {
        BrandProfileResponse response = transactionTemplate.execute(tx ->
                brandProfileMapper.toBrandProfileResponse(find(currentUser(email).getId(), id)));

        return ApiResponse.success("Lấy hồ sơ thương hiệu thành công", withSignedLogo(response));
    }

    @Override
    public ApiResponse<BrandProfileResponse> update(String email, UUID id, BrandProfileRequest request) {
        User user = currentUser(email);

        // Upload logo mới (HTTP Supabase) TRƯỚC khi mở transaction (rule #24).
        boolean replacingLogo = StringUtils.hasText(request.getLogoUrl()) && request.getLogoUrl().startsWith("data:");
        final String newLogoPath = replacingLogo
                ? storageService.uploadBase64BrandLogo(request.getLogoUrl(), user.getId().toString())
                : null;

        BrandProfileResponse response;
        try {
            response = transactionTemplate.execute(tx -> {
                BrandProfile profile = find(user.getId(), id);
                String oldLogoUrl = profile.getLogoUrl();
                brandProfileMapper.updateBrandProfile(profile, request);

                if (replacingLogo) {
                    deleteStorageFileIfPresent(oldLogoUrl); // xóa file cũ afterCommit
                    profile.setLogoUrl(newLogoPath);
                } else if (!StringUtils.hasText(request.getLogoUrl())) {
                    deleteStorageFileIfPresent(oldLogoUrl);
                    profile.setLogoUrl(null);
                }
                return brandProfileMapper.toBrandProfileResponse(brandProfileRepository.save(profile));
            });
        } catch (RuntimeException e) {
            // DB fail sau khi đã upload → dọn file vừa upload để không rác storage.
            if (newLogoPath != null) deleteLogoQuietly(newLogoPath);
            throw e;
        }

        return ApiResponse.success("Cập nhật hồ sơ thương hiệu thành công", withSignedLogo(response));
    }

    @Override
    @Transactional
    public ApiResponse<Void> delete(String email, UUID id) {
        BrandProfile profile = find(currentUser(email).getId(), id);
        // Xóa hồ sơ → dọn luôn file logo trong storage. Chạy afterCommit (rule #24) nên soft-delete
        // luôn commit trọn vẹn trước; xóa file thất bại chỉ log warn, không rollback record.
        deleteStorageFileIfPresent(profile.getLogoUrl());
        profile.setLogoUrl(null);
        profile.setDeletedAt(LocalDateTime.now());
        brandProfileRepository.save(profile);
        return ApiResponse.success("Xóa hồ sơ thương hiệu thành công");
    }

    // Rule #24: không gọi I/O Supabase trong khi transaction DB còn mở → defer tới sau commit
    // (bỏ qua khi rollback). Giống UserServiceImpl.scheduleOldAvatarDeletion.
    private void deleteStorageFileIfPresent(String storedLogo) {
        if (!StringUtils.hasText(storedLogo)) return; // không có logo (placeholder chữ cái) → không có file để xóa
        // URL ngoài hệ thống (không thuộc bucket brandlogos) → không phải file mình quản lý, bỏ qua.
        if (storedLogo.startsWith("http") && !storedLogo.contains("/" + StorageBuckets.BRAND_LOGOS + "/")) {
            log.info("Bỏ qua xóa logo ngoài storage (không thuộc bucket {}): {}", StorageBuckets.BRAND_LOGOS, storedLogo);
            return;
        }
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
            log.info("Đã xóa file logo '{}' khỏi bucket '{}'", path, StorageBuckets.BRAND_LOGOS);
        } catch (Exception e) {
            log.warn("Không xóa được file logo '{}' trong bucket '{}'", path, StorageBuckets.BRAND_LOGOS, e);
        }
    }

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
