package com.aima.trend;

import com.aima.dto.request.TrendResearchRequest;
import com.aima.entity.BrandProfile;
import com.aima.entity.ContentStrategy;
import com.aima.entity.TrendResearchSession;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.StrategyStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.TrendResearchMapper;
import com.aima.repository.BrandProfileRepository;
import com.aima.repository.ContentStrategyRepository;
import com.aima.repository.TrendRepository;
import com.aima.repository.TrendResearchSessionRepository;
import com.aima.repository.UserRepository;
import com.aima.scheduler.DailyTrendResearchJob;
import com.aima.service.PlanUsageService;
import com.aima.service.TokenUsageService;
import com.aima.service.TrendResearchWorkerService;
import com.aima.service.Impl.TrendResearchServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskRejectedException;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * "Research ngay": phiên tự động còn xếp hàng không chặn user; hàng đợi đầy → phiên FAILED ngay thay vì
 * PENDING mãi (guard 1 phiên/user sẽ chặn user vĩnh viễn).
 */
class TrendResearchStartTest {

    private TrendResearchSessionRepository sessionRepository;
    private TrendResearchWorkerService worker;
    private TrendResearchServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(TrendResearchSessionRepository.class);
        BrandProfileRepository brandRepository = mock(BrandProfileRepository.class);
        ContentStrategyRepository strategyRepository = mock(ContentStrategyRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        TrendResearchMapper mapper = mock(TrendResearchMapper.class);
        worker = mock(TrendResearchWorkerService.class);

        user = User.builder().email("u@aima.test").build();
        user.setId(UUID.randomUUID());
        BrandProfile brand = new BrandProfile();
        brand.setId(UUID.randomUUID());
        ContentStrategy strategy = new ContentStrategy();
        strategy.setId(UUID.randomUUID());
        strategy.setStatus(StrategyStatus.ACTIVE);

        when(userRepository.findByEmail("u@aima.test")).thenReturn(Optional.of(user));
        when(brandRepository.findFirstByUser_IdAndIsActiveTrueAndDeletedAtIsNull(user.getId())).thenReturn(Optional.of(brand));
        when(strategyRepository.findFirstByBrandProfile_IdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
                brand.getId(), StrategyStatus.ACTIVE)).thenReturn(Optional.of(strategy));
        when(mapper.toSession(any(), any(), any(), any(), any())).thenAnswer(inv -> new TrendResearchSession());
        when(sessionRepository.save(any())).thenAnswer(inv -> {
            TrendResearchSession s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        service = new TrendResearchServiceImpl(sessionRepository, mock(TrendRepository.class), brandRepository,
                strategyRepository, userRepository, mapper, worker, mock(TokenUsageService.class),
                mock(PlanUsageService.class));
    }

    @Test
    void manualStartSupersedesQueuedScheduledSessionBeforeTheGuard() {
        service.startResearch("u@aima.test", new TrendResearchRequest());

        var order = inOrder(sessionRepository);
        order.verify(sessionRepository).supersedeQueuedScheduled(eq(user.getId()), any(), anyString());
        order.verify(sessionRepository).existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(eq(user.getId()), anyCollection());
        verify(worker).process(any());
    }

    @Test
    void runningSessionStillBlocksASecondManualStart() {
        when(sessionRepository.existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(any(), anyCollection()))
                .thenReturn(true);
        AppException e = assertThrows(AppException.class,
                () -> service.startResearch("u@aima.test", new TrendResearchRequest()));
        assertEquals(ErrorCode.RESEARCH_ALREADY_RUNNING, e.getErrorCode());
        verify(worker, never()).process(any());
    }

    @Test
    void rejectedDispatchFailsTheSessionInsteadOfLeavingItPending() {
        doThrow(new TaskRejectedException("full")).when(worker).process(any());
        service.startResearch("u@aima.test", new TrendResearchRequest());
        verify(sessionRepository).failPending(any(), any(), anyString());
    }

    @Test
    void scheduledSessionUsesFirstStrategyPlatformInScopeOrder() throws Exception {
        Method platformOf = DailyTrendResearchJob.class.getDeclaredMethod("platformOf", ContentStrategy.class, BrandProfile.class);
        platformOf.setAccessible(true);
        ContentStrategy strategy = new ContentStrategy();
        BrandProfile brand = new BrandProfile();

        strategy.setPlatforms(Set.of(Platform.THREADS, Platform.INSTAGRAM));
        assertEquals(Platform.INSTAGRAM, platformOf.invoke(null, strategy, brand));

        strategy.setPlatforms(Set.of());
        brand.setPlatforms(Set.of(Platform.THREADS));
        assertEquals(Platform.THREADS, platformOf.invoke(null, strategy, brand));

        brand.setPlatforms(Set.of());
        assertEquals(Platform.FACEBOOK, platformOf.invoke(null, strategy, brand));
    }
}
