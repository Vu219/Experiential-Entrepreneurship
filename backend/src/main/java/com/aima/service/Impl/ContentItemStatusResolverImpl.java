package com.aima.service.Impl;

import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PostSchedule;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.projection.VersionPublishingState;
import com.aima.service.ContentItemStatusResolver;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Quy tắc tổng hợp (docs/CREATE_SCHEDULE_IMPLEMENTATION_PLAN.md §2.1), chỉ xét bản chưa xóa mềm;
 * lịch CANCELLED/xóa mềm coi như không có lịch:
 * <ol>
 *   <li>có lịch POSTING → POSTING;</li>
 *   <li>có lịch POSTED: mọi bản đều POSTED → POSTED, còn bản chưa đăng → PARTIALLY_POSTED;</li>
 *   <li>chưa bản nào đăng: ưu tiên FAILED → ON_HOLD → SCHEDULED;</li>
 *   <li>không còn lịch hiệu lực: mọi bản FORMATTED → FORMATTED; có nội dung → GENERATED; còn lại DRAFT.</li>
 * </ol>
 * Duyệt và analytics không tham gia.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(propagation = Propagation.MANDATORY) // khóa chỉ có nghĩa trong transaction của caller
public class ContentItemStatusResolverImpl implements ContentItemStatusResolver {

    ContentItemRepository contentItemRepository;
    ContentVersionRepository contentVersionRepository;

    @Override
    public ContentItem lock(UUID itemId) {
        return contentItemRepository.findByIdForUpdate(itemId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));
    }

    @Override
    public void lockAll(Collection<UUID> itemIds) {
        sortedDistinct(itemIds).forEach(this::lock);
    }

    @Override
    public ContentItemStatus refresh(UUID itemId) {
        ContentItem item = lock(itemId);
        // Truy vấn scalar (không lấy entity từ persistence context) — AUTO flush đẩy thay đổi của chính
        // transaction này xuống trước, phần còn lại là dữ liệu đã commit của transaction khác.
        List<VersionPublishingState> states = contentVersionRepository.findPublishingStates(itemId);
        return apply(item, resolve(states, hasItemContent(item)));
    }

    @Override
    public void refreshAll(Collection<UUID> itemIds) {
        sortedDistinct(itemIds).forEach(this::refresh);
    }

    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public ContentItemStatus initialize(ContentItem item) {
        List<VersionPublishingState> states = item.getContentVersions().stream()
                .filter(v -> v.getDeletedAt() == null)
                .map(v -> new VersionPublishingState(v.getStatus(), liveScheduleStatus(v)))
                .toList();
        return apply(item, resolve(states, hasItemContent(item)));
    }

    @Override
    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public ContentItemStatus preview(UUID itemId) {
        ContentItem item = contentItemRepository.findById(itemId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTENT_ITEM_NOT_FOUND));
        return resolve(contentVersionRepository.findPublishingStates(itemId), hasItemContent(item));
    }

    /** Hàm thuần của quy tắc tổng hợp — không phụ thuộc thứ tự bản/thứ tự hoàn thành. */
    public static ContentItemStatus resolve(Collection<VersionPublishingState> versions, boolean itemHasContent) {
        boolean posting = false, posted = false, failed = false, onHold = false, scheduled = false;
        boolean allPosted = !versions.isEmpty();
        boolean allFormatted = !versions.isEmpty();
        boolean hasContent = itemHasContent;
        for (VersionPublishingState v : versions) {
            ScheduleStatus schedule = v.scheduleStatus();
            posting |= schedule == ScheduleStatus.POSTING;
            posted |= schedule == ScheduleStatus.POSTED;
            failed |= schedule == ScheduleStatus.FAILED;
            onHold |= schedule == ScheduleStatus.ON_HOLD;
            scheduled |= schedule == ScheduleStatus.SCHEDULED;
            allPosted &= schedule == ScheduleStatus.POSTED;
            allFormatted &= v.status() == ContentVersionStatus.FORMATTED;
            hasContent |= v.status() != ContentVersionStatus.DRAFT;
        }
        if (posting) return ContentItemStatus.POSTING;
        if (posted) return allPosted ? ContentItemStatus.POSTED : ContentItemStatus.PARTIALLY_POSTED;
        if (failed) return ContentItemStatus.FAILED;
        if (onHold) return ContentItemStatus.ON_HOLD;
        if (scheduled) return ContentItemStatus.SCHEDULED;
        if (allFormatted) return ContentItemStatus.FORMATTED;
        return hasContent ? ContentItemStatus.GENERATED : ContentItemStatus.DRAFT;
    }

    private static ContentItemStatus apply(ContentItem item, ContentItemStatus resolved) {
        if (item.getStatus() != resolved) {
            log.info("[ContentStatus] Bài {}: {} → {}", item.getId(), item.getStatus(), resolved);
            item.applyResolvedStatus(resolved);
        }
        return resolved;
    }

    // CANCELLED = lịch đã hủy, không còn hiệu lực (cùng quy ước với truy vấn findPublishingStates).
    private static ScheduleStatus liveScheduleStatus(ContentVersion version) {
        PostSchedule schedule = version.getPostSchedule();
        if (schedule == null || schedule.getDeletedAt() != null || schedule.getStatus() == ScheduleStatus.CANCELLED) {
            return null;
        }
        return schedule.getStatus();
    }

    // Bài cũ (trước B2) giữ nội dung ngay trên item, không có bản nền tảng.
    private static boolean hasItemContent(ContentItem item) {
        return notBlank(item.getCaption()) || notBlank(item.getScript());
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static List<UUID> sortedDistinct(Collection<UUID> ids) {
        return ids.stream().distinct().sorted().toList();
    }
}
