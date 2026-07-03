package com.aima.service.Impl;

import com.aima.dto.request.ContentItemStatusRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.User;
import com.aima.enums.ContentLifecycle;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ContentItemService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * FR-33 (manual edit) + FR-34 (review before posting) trên {@link ContentItem}.
 * Chỉ theo state machine trong WORKFLOWS.md: Generated → Need Review → Approved.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ContentItemServiceImpl implements ContentItemService {

    // FR-33: chỉ sửa được trước khi vào pipeline đăng (WORKFLOWS.md).
    static final Set<ContentLifecycle> EDITABLE_STATUSES = EnumSet.of(
            ContentLifecycle.DRAFT, ContentLifecycle.GENERATED,
            ContentLifecycle.NEED_REVIEW, ContentLifecycle.APPROVED);

    // FR-34: các bước hợp lệ của review flow — Generated → Need Review → Approved.
    static final Map<ContentLifecycle, ContentLifecycle> REVIEW_TRANSITIONS = Map.of(
            ContentLifecycle.NEED_REVIEW, ContentLifecycle.GENERATED,
            ContentLifecycle.APPROVED, ContentLifecycle.NEED_REVIEW);

    ContentItemRepository contentItemRepository;
    UserRepository userRepository;
    ContentItemMapper contentItemMapper;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<ContentItemResponse> getItem(String email, UUID itemId) {
        ContentItem item = ownedItem(email, itemId);
        ContentItemResponse response = contentItemMapper.toResponse(item);
        return ApiResponse.success("Lấy nội dung thành công", response);
    }

    @Override
    public ApiResponse<ContentItemResponse> updateItem(String email, UUID itemId, ContentItemUpdateRequest request) {
        ContentItem item = ownedItem(email, itemId);
        if (!EDITABLE_STATUSES.contains(item.getStatus())) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_EDITABLE);
        }

        contentItemMapper.update(request, item);

        // Nội dung đã duyệt mà bị sửa thì phải duyệt lại (giữ review flow trung thực).
        if (item.getStatus() == ContentLifecycle.APPROVED) {
            item.setStatus(ContentLifecycle.NEED_REVIEW);
        }

        ContentItem saved = contentItemRepository.save(item);
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật nội dung thành công", response);
    }

    @Override
    public ApiResponse<ContentItemResponse> updateStatus(String email, UUID itemId, ContentItemStatusRequest request) {
        ContentItem item = ownedItem(email, itemId);

        ContentLifecycle target = request.getStatus();
        if (item.getStatus() != REVIEW_TRANSITIONS.get(target)) {
            throw new AppException(ErrorCode.INVALID_CONTENT_STATUS_TRANSITION);
        }

        item.setStatus(target);
        ContentItem saved = contentItemRepository.save(item);
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật trạng thái nội dung thành công", response);
    }

    private ContentItem ownedItem(String email, UUID itemId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        return contentItemRepository.findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(itemId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));
    }
}
