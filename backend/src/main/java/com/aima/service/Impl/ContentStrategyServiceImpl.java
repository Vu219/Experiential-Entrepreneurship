package com.aima.service.Impl;

import com.aima.dto.request.ContentStrategyRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentStrategyResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.User;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentStrategyMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentStrategyService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ContentStrategyServiceImpl implements ContentStrategyService {

    ContentStrategyRepository contentStrategyRepository;
    BrandProfileRepository brandProfileRepository;
    UserRepository userRepository;
    ContentStrategyMapper contentStrategyMapper;

    @Override
    public ApiResponse<ContentStrategyResponse> create(String email, ContentStrategyRequest request) {
        User user = currentUser(email);
        BrandProfile brand = findBrand(user.getId(), request.getBrandId());

        ContentStrategy strategy = contentStrategyMapper.toContentStrategy(request);
        strategy.setBrandProfile(brand);
        if (strategy.getStatus() == null) strategy.setStatus(StrategyStatus.DRAFT); // tạo mới = Nháp
        if (!StringUtils.hasText(strategy.getFrequencyUnit())) {
            strategy.setFrequencyUnit(ContentStrategy.DEFAULT_FREQUENCY_UNIT);
        }
        ContentStrategy saved = contentStrategyRepository.save(strategy);

        return ApiResponse.success("Tạo chiến lược nội dung thành công",
                contentStrategyMapper.toContentStrategyResponse(saved));
    }

    // FR-07: list — phân trang + lọc server-side (PageResponse dùng chung); brandId null → tất cả
    // của user, có brandId → theo brand (kiểm tra sở hữu); status/q rỗng → bỏ qua điều kiện.
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<ContentStrategyResponse>> list(String email, UUID brandId, StrategyStatus status,
                                                                   String q, Pageable pageable) {
        User user = currentUser(email);
        if (brandId != null) {
            findBrand(user.getId(), brandId);
        }
        String query = q == null ? "" : q.trim();
        Page<ContentStrategy> page = contentStrategyRepository.search(user.getId(), brandId, status, query, pageable);
        return ApiResponse.success("Lấy danh sách chiến lược nội dung thành công",
                PageResponse.from(page, contentStrategyMapper.toContentStrategyResponseList(page.getContent())));
    }

    // FR-07: view one
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ContentStrategyResponse> get(String email, UUID id) {
        ContentStrategy strategy = find(currentUser(email).getId(), id);
        return ApiResponse.success("Lấy chiến lược nội dung thành công",
                contentStrategyMapper.toContentStrategyResponse(strategy));
    }

    // FR-13: update
    @Override
    public ApiResponse<ContentStrategyResponse> update(String email, UUID id, ContentStrategyRequest request) {
        ContentStrategy strategy = find(currentUser(email).getId(), id);
        contentStrategyMapper.updateContentStrategy(strategy, request);
        if (!StringUtils.hasText(strategy.getFrequencyUnit())) {
            strategy.setFrequencyUnit(ContentStrategy.DEFAULT_FREQUENCY_UNIT);
        }
        ContentStrategy saved = contentStrategyRepository.save(strategy);
        return ApiResponse.success("Cập nhật chiến lược nội dung thành công",
                contentStrategyMapper.toContentStrategyResponse(saved));
    }

    // FR-13: activate / pause (DRAFT / ACTIVE / PAUSED)
    @Override
    public ApiResponse<ContentStrategyResponse> updateStatus(String email, UUID id, StrategyStatus status) {
        ContentStrategy strategy = find(currentUser(email).getId(), id);
        strategy.setStatus(status);
        ContentStrategy saved = contentStrategyRepository.save(strategy);
        return ApiResponse.success("Cập nhật trạng thái chiến lược thành công",
                contentStrategyMapper.toContentStrategyResponse(saved));
    }

    // FR-08: soft delete (không cascade StrategyAdjustment theo ghi chú entity)
    @Override
    public ApiResponse<Void> delete(String email, UUID id) {
        ContentStrategy strategy = find(currentUser(email).getId(), id);
        strategy.setDeletedAt(LocalDateTime.now());
        contentStrategyRepository.save(strategy);
        return ApiResponse.success("Xóa chiến lược nội dung thành công");
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
    }

    private BrandProfile findBrand(UUID userId, UUID brandId) {
        return brandProfileRepository.findByIdAndUser_IdAndDeletedAtIsNull(brandId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.BRAND_PROFILE_NOT_FOUND));
    }

    private ContentStrategy find(UUID userId, UUID id) {
        return contentStrategyRepository.findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND));
    }
}
