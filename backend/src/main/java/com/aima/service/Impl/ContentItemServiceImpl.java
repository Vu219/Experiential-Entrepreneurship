package com.aima.service.Impl;

import com.aima.dto.request.ContentItemCreateRequest;
import com.aima.dto.request.ContentItemStatusRequest;
import com.aima.dto.request.ContentItemUpdateRequest;
import com.aima.dto.request.ContentVersionUpdateRequest;
import com.aima.dto.request.ContentWizardStateRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ContentItemResponse;
import com.aima.dto.response.PageResponse;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentStrategy;
import com.aima.entity.ContentVersion;
import com.aima.entity.User;
import com.aima.enums.ActivityAction;
import com.aima.enums.ContentLifecycle;
import com.aima.enums.Platform;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.ContentItemMapper;
import com.aima.repository.ContentIdeaRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.ContentItemService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.List;
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

    ActivityLogService activityLogService;

    // FR-33: chỉ sửa được trước khi vào pipeline đăng (WORKFLOWS.md).
    // FR-39/EX-02: bài FAILED cũng sửa được (sửa xong hủy lịch FAILED → version về FORMATTED → lên lịch lại).
    static final Set<ContentLifecycle> EDITABLE_STATUSES = EnumSet.of(
            ContentLifecycle.DRAFT, ContentLifecycle.GENERATED,
            ContentLifecycle.NEED_REVIEW, ContentLifecycle.APPROVED, ContentLifecycle.FAILED);

    // FR-34: các bước hợp lệ của review flow — Generated → Need Review → Approved.
    // B2: bài giữ DRAFT suốt wizard (job không lật status) → user gửi duyệt từ DRAFT.
    // "Trả về sửa": NEED_REVIEW → GENERATED (bài quay lại trạng thái AI đã tạo để sửa tiếp).
    static final Map<ContentLifecycle, Set<ContentLifecycle>> REVIEW_TRANSITIONS = Map.of(
            ContentLifecycle.NEED_REVIEW, EnumSet.of(ContentLifecycle.DRAFT, ContentLifecycle.GENERATED),
            ContentLifecycle.APPROVED, EnumSet.of(ContentLifecycle.NEED_REVIEW),
            ContentLifecycle.GENERATED, EnumSet.of(ContentLifecycle.NEED_REVIEW));

    // FR-89: chỉ xóa được khi chưa vào pipeline (Draft/Generated); Scheduled/Posting/Posted cấm xóa.
    static final Set<ContentLifecycle> DELETABLE_STATUSES =
            EnumSet.of(ContentLifecycle.DRAFT, ContentLifecycle.GENERATED);

    ContentItemRepository contentItemRepository;
    ContentStrategyRepository contentStrategyRepository;
    ContentIdeaRepository contentIdeaRepository;
    UserRepository userRepository;
    ContentItemMapper contentItemMapper;

    // FR-87: thư viện nội dung — mọi filter đều optional (null/rỗng = bỏ qua). Sắp xếp server-side
    // qua ORDER BY trong repository (newest/voice/status), nên Pageable KHÔNG mang Sort riêng.
    static final Set<String> SORT_OPTIONS = Set.of("newest", "voice", "status");

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<ContentItemResponse>> list(String email, ContentLifecycle status,
                                                               UUID brandProfileId, Platform platform,
                                                               String industry, LocalDate fromDate, LocalDate toDate,
                                                               String q, String sort, int page, int size) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));

        // Giá trị sort lạ → mặc định 'newest' (ORDER BY của query tự fallback createdAt desc).
        String sortKey = sort != null && SORT_OPTIONS.contains(sort) ? sort : "newest";
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        LocalDateTime from = fromDate == null ? null : fromDate.atStartOfDay();
        LocalDateTime to = toDate == null ? null : toDate.atTime(LocalTime.MAX);
        Page<ContentItem> items = contentItemRepository.search(user.getId(),
                status == null ? null : status.name(),
                brandProfileId,
                platform == null ? null : platform.name(),
                industry == null ? "" : industry.trim(), from, to,
                q == null ? "" : q.trim(), sortKey, pageable);

        List<ContentItemResponse> content = items.getContent().stream()
                .map(contentItemMapper::toResponse)
                .toList();
        PageResponse<ContentItemResponse> response = PageResponse.from(items, content);
        return ApiResponse.success("Lấy thư viện nội dung thành công", response);
    }

    // B2: tạo bài (shell DRAFT) trước khi bắn các job generate — mỗi nền tảng một job
    // ghi ContentVersion vào bài này. Chỉ chiến lược ACTIVE (BR-01, BR-03, FR-13).
    @Override
    public ApiResponse<ContentItemResponse> create(String email, ContentItemCreateRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        ContentStrategy strategy = contentStrategyRepository
                .findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(request.getStrategyId(), user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_STRATEGY_NOT_FOUND));
        if (strategy.getStatus() != StrategyStatus.ACTIVE) {
            throw new AppException(ErrorCode.STRATEGY_NOT_ACTIVE);
        }

        ContentItem item = new ContentItem();
        item.setBrandProfile(strategy.getBrandProfile());
        // Idea gắn kèm resolve "mềm" (cùng triết lý worker generate): id lạ/không thuộc user → bỏ qua.
        if (request.getIdeaId() != null) {
            contentIdeaRepository
                    .findByIdAndTrend_ResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(request.getIdeaId(), user.getId())
                    .ifPresent(item::setContentIdea);
        }

        ContentItem saved = contentItemRepository.save(item); // status default DRAFT
        activityLogService.record(ActivityLogService.Entry.of(
                ActivityAction.CONTENT_CREATED, user.getId(), user.getEmail(),
                "ContentItem", saved.getId().toString()));
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Đã tạo bài nội dung", response);
    }

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
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.CONTENT_UPDATED, email, "ContentItem", itemId.toString(), null));
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật nội dung thành công", response);
    }

    // B2/FR-33: sửa thủ công MỘT bản nền tảng — partial update, cùng ràng buộc trạng thái
    // với sửa bài; bài APPROVED bị sửa quay về NEED_REVIEW (review flow trung thực).
    @Override
    public ApiResponse<ContentItemResponse> updateVersion(String email, UUID itemId, UUID versionId,
                                                          ContentVersionUpdateRequest request) {
        ContentItem item = ownedItem(email, itemId);
        if (!EDITABLE_STATUSES.contains(item.getStatus())) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_EDITABLE);
        }

        ContentVersion version = item.getContentVersions().stream()
                .filter(v -> v.getId().equals(versionId) && v.getDeletedAt() == null)
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_VERSION_NOT_FOUND));

        contentItemMapper.updateVersion(request, version);
        if (item.getStatus() == ContentLifecycle.APPROVED) {
            item.setStatus(ContentLifecycle.NEED_REVIEW);
        }

        ContentItem saved = contentItemRepository.save(item); // version lưu qua cascade
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật bản nội dung thành công", response);
    }

    @Override
    public ApiResponse<ContentItemResponse> updateStatus(String email, UUID itemId, ContentItemStatusRequest request) {
        ContentItem item = ownedItem(email, itemId);

        ContentLifecycle target = request.getStatus();
        Set<ContentLifecycle> allowedFrom = REVIEW_TRANSITIONS.get(target);
        if (allowedFrom == null || !allowedFrom.contains(item.getStatus())) {
            throw new AppException(ErrorCode.INVALID_CONTENT_STATUS_TRANSITION);
        }

        item.setStatus(target);
        // Bài đã rời DRAFT → trạng thái wizard hết ý nghĩa; dọn để danh sách không còn coi là bài dở.
        if (target != ContentLifecycle.DRAFT) {
            item.setWizardStep(null);
            item.setWizardPlatforms(null);
            item.setWizardNote(null);
            item.setTrendId(null);
        }
        ContentItem saved = contentItemRepository.save(item);
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.CONTENT_STATUS_CHANGED, email, "ContentItem", itemId.toString(),
                Map.of("status", target.name())));
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Cập nhật trạng thái nội dung thành công", response);
    }

    // Auto-save wizard (debounce phía FE): chỉ khi bài còn DRAFT — trạng thái khác nghĩa là
    // bài đã rời wizard, snapshot không còn giá trị resume.
    @Override
    public ApiResponse<ContentItemResponse> updateWizardState(String email, UUID itemId,
                                                              ContentWizardStateRequest request) {
        ContentItem item = ownedItem(email, itemId);
        if (item.getStatus() != ContentLifecycle.DRAFT) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_EDITABLE);
        }

        contentItemMapper.updateWizardState(request, item);
        // Idea gắn kèm resolve "mềm" như create: id lạ/không thuộc user → bỏ qua.
        if (request.getIdeaId() != null) {
            contentIdeaRepository
                    .findByIdAndTrend_ResearchSession_BrandProfile_User_IdAndDeletedAtIsNull(
                            request.getIdeaId(), item.getBrandProfile().getUser().getId())
                    .ifPresent(item::setContentIdea);
        }

        ContentItem saved = contentItemRepository.save(item);
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Đã lưu trạng thái wizard", response);
    }

    // FR-89: xóa mềm item + cascade các ContentVersion/MediaAsset còn hiệu lực (DATA_MODEL.md).
    @Override
    public ApiResponse<ContentItemResponse> delete(String email, UUID itemId) {
        ContentItem item = ownedItem(email, itemId);
        if (!DELETABLE_STATUSES.contains(item.getStatus())) {
            throw new AppException(ErrorCode.CONTENT_ITEM_NOT_DELETABLE);
        }

        LocalDateTime now = LocalDateTime.now();
        item.setDeletedAt(now);
        item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null)
                .forEach(v -> v.setDeletedAt(now));
        item.getMediaAssets().stream()
                .filter(m -> m.getDeletedAt() == null)
                .forEach(m -> m.setDeletedAt(now));

        ContentItem saved = contentItemRepository.save(item);
        activityLogService.record(ActivityLogService.Entry.byActor(
                ActivityAction.CONTENT_DELETED, email, "ContentItem", itemId.toString(), null));
        ContentItemResponse response = contentItemMapper.toResponse(saved);
        return ApiResponse.success("Đã xóa nội dung", response);
    }

    private ContentItem ownedItem(String email, UUID itemId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        return contentItemRepository.findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(itemId, user.getId())
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));
    }
}
