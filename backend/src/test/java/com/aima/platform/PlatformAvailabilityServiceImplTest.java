package com.aima.platform;

import com.aima.dto.request.PlatformAvailabilityRequest;
import com.aima.entity.PlatformAvailability;
import com.aima.entity.User;
import com.aima.enums.HoldReason;
import com.aima.enums.Platform;
import com.aima.enums.PlatformLockReason;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlatformAvailabilityMapperImpl;
import com.aima.repository.PlatformAccountRepository;
import com.aima.repository.PlatformAvailabilityRepository;
import com.aima.repository.PostScheduleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.PlanLimitService;
import com.aima.service.PlanUsageService;
import com.aima.service.ScheduleHeldNotifier;
import com.aima.service.ScheduleHoldService;
import com.aima.service.Impl.PlatformAvailabilityServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/** PlatformAvailabilityService: cache 30s + xoá khi admin đổi, lockReasonNow đọc DB, khoá bắt buộc lý do, khoá hệ thống thắng gói. */
class PlatformAvailabilityServiceImplTest {

    private PlatformAvailabilityRepository repository;
    private PlanLimitService planLimitService;
    private ScheduleHoldService holdService;
    private PlatformAvailabilityServiceImpl service;
    private PlatformAvailability threads;
    private final User user = User.builder().email("u@it.local").build();

    @BeforeEach
    void setUp() {
        repository = mock(PlatformAvailabilityRepository.class);
        planLimitService = mock(PlanLimitService.class);
        holdService = mock(ScheduleHoldService.class);
        UserRepository userRepository = mock(UserRepository.class);
        User admin = User.builder().email("admin@it.local").build();
        admin.setId(UUID.randomUUID());
        when(userRepository.findByEmail("admin@it.local")).thenReturn(Optional.of(admin));
        threads = PlatformAvailability.builder().platform(Platform.THREADS).connectionEnabled(true).build();
        when(repository.findByPlatformAndDeletedAtIsNull(Platform.THREADS)).thenReturn(Optional.of(threads));
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        PlatformAccountRepository accounts = mock(PlatformAccountRepository.class);
        when(accounts.findByPlatformNameAndDeletedAtIsNull(any())).thenReturn(List.of());
        when(planLimitService.features(any())).thenReturn(new PlanLimitService.FeatureLimits("PRO",
                new EnumMap<>(com.aima.enums.PlanLimitKey.class), Set.of(Platform.FACEBOOK)));
        service = new PlatformAvailabilityServiceImpl(repository, accounts, mock(PostScheduleRepository.class),
                userRepository, holdService, mock(ScheduleHeldNotifier.class), mock(ActivityLogService.class),
                planLimitService, mock(PlanUsageService.class), new PlatformAvailabilityMapperImpl());
    }

    @Test
    void isEnabled_isCachedUntilAdminChangesIt() {
        assertTrue(service.isEnabled(Platform.THREADS));
        assertTrue(service.isEnabled(Platform.THREADS));
        verify(repository, times(1)).findByPlatformAndDeletedAtIsNull(Platform.THREADS);

        service.update(Platform.THREADS, PlatformAvailabilityRequest.builder().enabled(false)
                .reasonVi("Bảo trì").reasonEn("Maintenance").build(), "admin@it.local");

        assertFalse(service.isEnabled(Platform.THREADS), "admin đổi → xoá cache ngay");
    }

    @Test
    void lockReasonNow_readsDatabaseEvenWhenCacheSaysEnabled() {
        assertTrue(service.isEnabled(Platform.THREADS)); // cache: mở
        threads.setConnectionEnabled(false);             // instance khác khoá trong DB

        assertTrue(service.isEnabled(Platform.THREADS), "cache chưa hết hạn");
        assertEquals(PlatformLockReason.PLATFORM_DISABLED, service.lockReasonNow(user, Platform.THREADS));
    }

    @Test
    void systemLockWinsOverPlan_planExclusionReportedWhenSystemOpen() {
        assertEquals(PlatformLockReason.PLAN_EXCLUDED, service.lockReason(user, Platform.THREADS),
                "Threads mở toàn hệ thống nhưng gói chỉ có Facebook");
        threads.setConnectionEnabled(false);
        assertEquals(PlatformLockReason.PLATFORM_DISABLED, service.lockReasonNow(user, Platform.THREADS));
        assertEquals(HoldReason.PLATFORM_DISABLED, PlatformLockReason.PLATFORM_DISABLED.holdReason());
    }

    @Test
    void lockingRequiresBothReasons() {
        AppException e = assertThrows(AppException.class, () -> service.update(Platform.THREADS,
                PlatformAvailabilityRequest.builder().enabled(false).reasonVi("Bảo trì").build(), "admin@it.local"));
        assertEquals(ErrorCode.PLATFORM_LOCK_REASON_REQUIRED, e.getErrorCode());
        verify(holdService, never()).holdForAccounts(anyCollection(), any());
    }

    @Test
    void unlocking_neverReleasesHolds() {
        threads.setConnectionEnabled(false);
        service.update(Platform.THREADS, PlatformAvailabilityRequest.builder().enabled(true).build(), "admin@it.local");

        assertTrue(threads.getConnectionEnabled());
        assertNull(threads.getReasonVi());
        verify(holdService, never()).releaseForAccounts(anyCollection(), any());
    }
}
