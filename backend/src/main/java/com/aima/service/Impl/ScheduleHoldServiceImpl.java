package com.aima.service.Impl;

import com.aima.entity.ContentItem;
import com.aima.entity.PostSchedule;
import com.aima.entity.UserPublishingSettings;
import com.aima.enums.HoldReason;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.mapper.PostScheduleMapper;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.UserPublishingSettingsRepository;
import com.aima.service.ContentItemStatusResolver;
import com.aima.service.ScheduleHoldService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional
public class ScheduleHoldServiceImpl implements ScheduleHoldService {

    /** Lịch chưa đăng có thể nhận/gỡ lý do tạm giữ. */
    static final List<ScheduleStatus> HOLDABLE = List.of(ScheduleStatus.SCHEDULED, ScheduleStatus.ON_HOLD);

    PostScheduleRepository scheduleRepository;
    UserPublishingSettingsRepository settingsRepository;
    PostScheduleMapper postScheduleMapper;
    ContentItemStatusResolver statusResolver;

    @Override
    public boolean hold(PostSchedule schedule, HoldReason reason) {
        if (!HOLDABLE.contains(schedule.getStatus())) {
            return false;
        }
        schedule.setStatus(ScheduleStatus.ON_HOLD);
        if (hasReason(schedule, reason)) {
            return false;
        }
        schedule.getHolds().add(postScheduleMapper.toHold(schedule, reason, Instant.now()));
        log.info("[ScheduleHold] Lịch {} + {}", schedule.getId(), reason);
        return true;
    }

    @Override
    public boolean release(PostSchedule schedule, HoldReason reason, boolean resume) {
        boolean removed = schedule.getHolds().removeIf(h -> h.getReason() == reason);
        if (removed) {
            log.info("[ScheduleHold] Lịch {} − {}", schedule.getId(), reason);
        }
        if (resume && schedule.getStatus() == ScheduleStatus.ON_HOLD && schedule.getHolds().isEmpty()
                && schedule.getScheduledTime().isAfter(Instant.now())) {
            schedule.setStatus(ScheduleStatus.SCHEDULED);
        }
        return removed;
    }

    @Override
    public void syncReviewHolds(ContentItem item) {
        boolean needsReview = requiresApproval(item.getBrandProfile().getUser().getId())
                && item.getReviewStatus() != ReviewStatus.APPROVED;
        for (PostSchedule schedule : scheduleRepository
                .findByContentVersion_ContentItem_IdAndStatusInAndDeletedAtIsNull(item.getId(), HOLDABLE)) {
            if (schedule.getContentVersion().getDeletedAt() != null) {
                continue;
            }
            if (needsReview) {
                hold(schedule, HoldReason.PENDING_REVIEW);
            } else if (hasReason(schedule, HoldReason.PENDING_REVIEW)) {
                release(schedule, HoldReason.PENDING_REVIEW, true);
            }
        }
        statusResolver.refresh(item.getId());
    }

    @Override
    public void onContentChanged(ContentItem item) {
        if (item.getReviewStatus() == ReviewStatus.APPROVED) {
            item.setReviewStatus(ReviewStatus.NEED_REVIEW);
        }
        syncReviewHolds(item);
    }

    @Override
    public void syncReviewHoldsForUser(UUID userId) {
        List<UUID> itemIds = scheduleRepository.findContentItemIdsByUser(userId, HOLDABLE);
        statusResolver.lockAll(itemIds);
        itemIds.stream().distinct().sorted().forEach(id -> syncReviewHolds(statusResolver.lock(id)));
    }

    @Override
    public int holdForAccounts(Collection<UUID> accountIds, HoldReason reason) {
        if (accountIds.isEmpty()) {
            return 0;
        }
        Set<UUID> itemIds = new HashSet<>(scheduleRepository.findContentItemIdsByAccounts(accountIds, HOLDABLE));
        statusResolver.lockAll(itemIds);
        // Lịch sinh ra sau lúc lấy danh sách bài chưa được khóa → bỏ qua (dispatcher sẽ tự chặn tài khoản hỏng).
        int held = 0;
        for (PostSchedule schedule : scheduleRepository.findByPlatformAccount_IdInAndStatusInAndDeletedAtIsNull(accountIds, HOLDABLE)) {
            if (itemIds.contains(itemIdOf(schedule)) && hold(schedule, reason)) {
                held++;
            }
        }
        statusResolver.refreshAll(itemIds);
        return held;
    }

    @Override
    public int releaseForAccounts(Collection<UUID> accountIds, HoldReason reason) {
        if (accountIds.isEmpty()) {
            return 0;
        }
        List<ScheduleStatus> onHold = List.of(ScheduleStatus.ON_HOLD);
        Set<UUID> itemIds = new HashSet<>(scheduleRepository.findContentItemIdsByAccounts(accountIds, onHold));
        statusResolver.lockAll(itemIds);
        int resumed = 0;
        for (PostSchedule schedule : scheduleRepository.findByPlatformAccount_IdInAndStatusInAndDeletedAtIsNull(accountIds, onHold)) {
            if (itemIds.contains(itemIdOf(schedule)) && release(schedule, reason, true)
                    && schedule.getStatus() == ScheduleStatus.SCHEDULED) {
                resumed++;
            }
        }
        statusResolver.refreshAll(itemIds);
        return resumed;
    }

    @Override
    public int releaseForUser(UUID userId, HoldReason reason, boolean resume) {
        List<ScheduleStatus> onHold = List.of(ScheduleStatus.ON_HOLD);
        Set<UUID> itemIds = new HashSet<>(scheduleRepository.findContentItemIdsByUser(userId, onHold));
        statusResolver.lockAll(itemIds);
        int released = 0;
        for (PostSchedule schedule : scheduleRepository.findByPlatformAccount_User_IdAndStatusInAndDeletedAtIsNull(userId, onHold)) {
            if (itemIds.contains(itemIdOf(schedule)) && release(schedule, reason, resume)) {
                released++;
            }
        }
        statusResolver.refreshAll(itemIds);
        return released;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean requiresApproval(UUID userId) {
        return settingsRepository.findById(userId).map(UserPublishingSettings::isRequireApproval).orElse(false);
    }

    private static boolean hasReason(PostSchedule schedule, HoldReason reason) {
        return schedule.getHolds().stream().anyMatch(h -> h.getReason() == reason);
    }

    private static UUID itemIdOf(PostSchedule schedule) {
        return schedule.getContentVersion().getContentItem().getId();
    }
}
