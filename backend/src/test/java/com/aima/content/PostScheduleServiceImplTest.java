package com.aima.content;

import com.aima.dto.request.PostScheduleRequest;
import com.aima.dto.request.PostScheduleUpdateRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PlatformAccount;
import com.aima.entity.User;
import com.aima.enums.ConnectionStatus;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlatformAccountType;
import com.aima.enums.ReviewStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.enums.TokenType;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentItemRepository;
import com.aima.repository.ContentVersionRepository;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PostScheduleService;
import com.aima.service.Impl.PostScheduleServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PostScheduleServiceImplTest {
    private final PostScheduleServiceImpl unwired = new PostScheduleServiceImpl(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

    @Autowired PostScheduleService service;
    @Autowired com.aima.service.ScheduleHoldService holdService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired BrandProfileRepository brandProfileRepository;
    @Autowired ContentItemRepository contentItemRepository;
    @Autowired ContentVersionRepository contentVersionRepository;
    @Autowired PlatformAccountRepository accountRepository;

    String email;
    BrandProfile brand;
    PlatformAccount page;

    @Test void createRejectsPastInstantBeforePersistenceEvenWithoutControllerValidation() {
        var request = PostScheduleRequest.builder().scheduledTime(Instant.parse("2000-01-01T00:00:00Z")).build();
        var error = assertThrows(AppException.class, () -> unwired.create("owner@aima.invalid", request, null));
        assertEquals(ErrorCode.SCHEDULE_TIME_IN_PAST, error.getErrorCode());
    }
    @Test void rescheduleRejectsPastInstantAndMissingTime() {
        var request = PostScheduleUpdateRequest.builder().scheduledTime(Instant.EPOCH).build();
        assertEquals(ErrorCode.SCHEDULE_TIME_IN_PAST,
                assertThrows(AppException.class, () -> unwired.update("owner@aima.invalid", UUID.randomUUID(), request)).getErrorCode());
        request.setScheduledTime(null);
        assertEquals(ErrorCode.SCHEDULE_TIME_REQUIRED,
                assertThrows(AppException.class, () -> unwired.update("owner@aima.invalid", UUID.randomUUID(), request)).getErrorCode());
    }

    // ===== Phase 1: lịch không đổi trạng thái sản xuất/duyệt; trạng thái tổng do resolver tính lại

    @BeforeEach
    void owner() {
        email = "schedule-" + UUID.randomUUID() + "@it.local";
        User user = userRepository.save(User.builder()
                .username(email).email(email).fullName("Schedule IT").password("{noop}x")
                .role(roleRepository.findByRoleName("USER").orElseThrow())
                .status(UserStatus.ACTIVE).plan(UserPlan.FREE).build());
        brand = new BrandProfile();
        brand.setUser(user);
        brand.setBrandName("Brand IT");
        brand.setIndustry("Beauty");
        brand.setTargetAudience("Everyone");
        brand = brandProfileRepository.save(brand);

        page = new PlatformAccount();
        page.setUser(user);
        page.setPlatformName(Platform.FACEBOOK);
        page.setPlatformAccountId("page-" + UUID.randomUUID());
        page.setAccountName("Page IT");
        page.setAccountType(PlatformAccountType.PAGE);
        page.setTokenType(TokenType.PAGE_TOKEN);
        page.setAccessToken("fake-page-token");
        page.setConnectionStatus(ConnectionStatus.ACTIVE);
        page = accountRepository.save(page);
    }

    @Test
    void cancellingOneOrAllSchedulesKeepsApprovalAndRecomputesAggregate() {
        ContentItem item = formattedItem(ReviewStatus.APPROVED);
        ContentVersion first = version(item);
        ContentVersion second = version(item);

        UUID s1 = schedule(first).getId();
        UUID s2 = schedule(second).getId();
        assertItem(item, ContentItemStatus.SCHEDULED, ReviewStatus.APPROVED);
        assertEquals(ContentVersionStatus.FORMATTED, contentVersionRepository.findById(first.getId()).orElseThrow().getStatus(),
                "lên lịch không đổi trạng thái sản xuất của bản");

        service.cancel(email, s1);
        assertItem(item, ContentItemStatus.SCHEDULED, ReviewStatus.APPROVED);
        service.cancel(email, s2);
        assertItem(item, ContentItemStatus.FORMATTED, ReviewStatus.APPROVED);

        // Lịch CANCELLED được tái sử dụng khi lên lịch lại, bài trở lại SCHEDULED.
        assertEquals(s1, schedule(first).getId());
        assertItem(item, ContentItemStatus.SCHEDULED, ReviewStatus.APPROVED);
    }

    @Test
    void holdAndReactivateRecomputeAggregate() {
        ContentItem item = formattedItem(ReviewStatus.NONE);
        UUID scheduleId = schedule(version(item)).getId();

        assertEquals(1, holdService.holdForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE));
        assertItem(item, ContentItemStatus.ON_HOLD, ReviewStatus.NONE);

        var stillHeld = service.update(email, scheduleId, PostScheduleUpdateRequest.builder()
                .scheduledTime(Instant.now().plus(Duration.ofDays(2))).build()).getResult();
        assertEquals(ScheduleStatus.ON_HOLD, stillHeld.getStatus(), "còn lý do tạm giữ → dời giờ không kích hoạt lại");
        assertEquals(List.of(HoldReason.ACCOUNT_ISSUE), stillHeld.getHoldReasons());

        // Kết nối lại: gỡ ACCOUNT_ISSUE, hết lý do + còn giờ → tự SCHEDULED.
        assertEquals(1, holdService.releaseForAccounts(List.of(page.getId()), HoldReason.ACCOUNT_ISSUE));
        assertItem(item, ContentItemStatus.SCHEDULED, ReviewStatus.NONE);
        assertEquals(0, holdService.holdForAccounts(List.of(), HoldReason.ACCOUNT_ISSUE));
    }

    @Test
    void onlyFormattedVersionsCanBeScheduledAndOnlyOnce() {
        ContentItem item = formattedItem(ReviewStatus.NONE);
        ContentVersion generated = version(item);
        generated.setStatus(ContentVersionStatus.GENERATED);
        contentVersionRepository.save(generated);
        assertEquals(ErrorCode.CONTENT_VERSION_NOT_SCHEDULABLE,
                assertThrows(AppException.class, () -> schedule(generated)).getErrorCode());

        ContentVersion formatted = version(item);
        schedule(formatted);
        assertEquals(ErrorCode.SCHEDULE_ALREADY_EXISTS, assertThrows(AppException.class, () -> schedule(formatted)).getErrorCode());
        assertEquals(ErrorCode.CONTENT_VERSION_NOT_FOUND, assertThrows(AppException.class,
                () -> service.create(email, PostScheduleRequest.builder().contentVersionId(UUID.randomUUID())
                        .platformAccountId(page.getId()).scheduledTime(Instant.now().plus(Duration.ofDays(1))).build(), null))
                .getErrorCode());
    }

    private com.aima.dto.response.PostScheduleResponse schedule(ContentVersion version) {
        return service.create(email, PostScheduleRequest.builder()
                .contentVersionId(version.getId())
                .platformAccountId(page.getId())
                .scheduledTime(Instant.now().plus(Duration.ofDays(1)))
                .build(), null).getResult();
    }

    private void assertItem(ContentItem item, ContentItemStatus status, ReviewStatus review) {
        ContentItem fresh = contentItemRepository.findById(item.getId()).orElseThrow();
        assertEquals(status, fresh.getStatus());
        assertEquals(review, fresh.getReviewStatus());
    }

    private ContentItem formattedItem(ReviewStatus review) {
        ContentItem item = new ContentItem();
        item.setBrandProfile(brand);
        item.applyResolvedStatus(ContentItemStatus.FORMATTED);
        item.setReviewStatus(review);
        return contentItemRepository.save(item);
    }

    private ContentVersion version(ContentItem item) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setPlatformName(Platform.FACEBOOK);
        version.setFormattedCaption("Caption");
        version.setStatus(ContentVersionStatus.FORMATTED);
        return contentVersionRepository.save(version);
    }
}
