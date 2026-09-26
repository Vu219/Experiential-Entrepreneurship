package com.aima.usage;

import com.aima.dto.response.PageResponse;
import com.aima.dto.response.UserUsageRowResponse;
import com.aima.entity.Plan;
import com.aima.entity.Subscription;
import com.aima.entity.User;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.UsageMapper;
import com.aima.repository.AiUsageRepository;
import com.aima.repository.SubscriptionRepository;
import com.aima.repository.UsageAdjustmentRepository;
import com.aima.repository.UsageHourlyRepository;
import com.aima.repository.UserRepository;
import com.aima.service.Impl.UsageQueryServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Bộ lọc khoảng thời gian của trang admin "Token & hạn mức": validate from/to, khoảng so sánh của
 * Tổng quan, và chế độ xem LỊCH SỬ của Theo người dùng (đọc rollup, bỏ filter ngưỡng hạn mức).
 * Repository mock — kiểm logic service, không kiểm SQL.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UsageRangeQueryTest {

    @Mock UserRepository userRepository;
    @Mock AiUsageRepository aiUsageRepository;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock UsageAdjustmentRepository usageAdjustmentRepository;
    @Mock UsageHourlyRepository usageHourlyRepository;
    @Mock UsageMapper usageMapper;

    @InjectMocks UsageQueryServiceImpl service;

    private static final LocalDate SEP_1 = LocalDate.of(2026, 9, 1);

    // ---------- validate khoảng ----------

    @Test
    void missingOrReversedRangeIsRejected() {
        assertErr(ErrorCode.USAGE_RANGE_INVALID, () -> service.overview(SEP_1, null));
        assertErr(ErrorCode.USAGE_RANGE_INVALID, () -> service.overview(null, SEP_1));
        assertErr(ErrorCode.USAGE_RANGE_INVALID, () -> service.overview(SEP_1, SEP_1.minusDays(1)));
    }

    @Test
    void rangeLongerThan366DaysIsRejected() {
        assertErr(ErrorCode.USAGE_RANGE_TOO_LARGE, () -> service.byPlan(SEP_1, SEP_1.plusDays(366)));
        stubOverviewRepos();
        assertDoesNotThrow(() -> service.overview(SEP_1, SEP_1.plusDays(365)));
    }

    // ---------- Tổng quan: khoảng tuỳ chọn so với khoảng liền trước cùng độ dài ----------

    @Test
    void customOverviewComparesWithPrecedingWindowOfSameLength() {
        stubOverviewRepos();

        service.overview(SEP_1, LocalDate.of(2026, 9, 7)); // 7 ngày, to BAO GỒM

        LocalDateTime start = SEP_1.atStartOfDay();
        LocalDateTime end = LocalDate.of(2026, 9, 8).atStartOfDay();
        verify(usageHourlyRepository).totals(start, end);
        verify(usageHourlyRepository).totals(LocalDate.of(2026, 8, 25).atStartOfDay(), start);
        verify(usageHourlyRepository).byTask(start, end);
    }

    // ---------- Theo người dùng: chế độ lịch sử ----------

    @Test
    void historicalByUserReadsRollupAndIgnoresThresholdFilter() {
        UUID light = UUID.randomUUID();
        UUID heavy = UUID.randomUUID();
        List<Subscription> subs = List.of(subscription(light, 1_000L), subscription(heavy, 1_000L));
        when(subscriptionRepository.findAllWithPlanAndUser()).thenReturn(subs);
        when(usageHourlyRepository.billableByUser(any(), any()))
                .thenReturn(List.of(billable(light, 100L), billable(heavy, 5_000L)));
        when(usageMapper.toUserRow(any(Subscription.class), anyLong())).thenAnswer(inv -> {
            Subscription s = inv.getArgument(0);
            return UserUsageRowResponse.builder()
                    .userId(s.getUser().getId()).used(inv.getArgument(1)).limit(s.getPlan().getMonthlyTokenLimit())
                    .build();
        });

        // "exceeded" ở kỳ hiện tại chỉ còn user vượt — xem lịch sử thì filter bị bỏ qua, đủ cả 2 user.
        PageResponse<UserUsageRowResponse> page = service
                .byUser("exceeded", null, 0, 10, SEP_1, LocalDate.of(2026, 9, 30))
                .getResult();

        assertEquals(2, page.getContent().size());
        assertEquals(heavy, page.getContent().get(0).getUserId()); // vẫn sắp theo mức dùng giảm dần
        assertEquals(5_000L, page.getContent().get(0).getUsed());
        assertEquals(100L, page.getContent().get(1).getUsed());
        verify(usageHourlyRepository).billableByUser(SEP_1.atStartOfDay(), LocalDate.of(2026, 10, 1).atStartOfDay());
        // Không đụng event thô (có thể đã bị retention xoá) và không trừ grant/reset.
        verifyNoInteractions(aiUsageRepository, usageAdjustmentRepository);
    }

    // ---------- helper ----------

    private void stubOverviewRepos() {
        UsageHourlyRepository.TotalsAgg zero = mock(UsageHourlyRepository.TotalsAgg.class);
        when(zero.getTotalTokens()).thenReturn(0L);
        when(usageHourlyRepository.totals(any(), any())).thenReturn(zero);
        when(usageHourlyRepository.byTask(any(), any())).thenReturn(List.of());
        when(usageHourlyRepository.byModel(any(), any())).thenReturn(List.of());
        when(usageHourlyRepository.topUsers(any(), any(), any())).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of());
    }

    private static Subscription subscription(UUID userId, long limit) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        Plan plan = mock(Plan.class);
        when(plan.getMonthlyTokenLimit()).thenReturn(limit);
        Subscription s = mock(Subscription.class);
        when(s.getUser()).thenReturn(user);
        when(s.getPlan()).thenReturn(plan);
        return s;
    }

    private static UsageHourlyRepository.UserBillableAgg billable(UUID userId, long units) {
        return new UsageHourlyRepository.UserBillableAgg() {
            public UUID getUserId() { return userId; }
            public Long getBillableUnits() { return units; }
            public BigDecimal getCostUsd() { return BigDecimal.ONE; }
        };
    }

    private static void assertErr(ErrorCode code, Runnable call) {
        AppException ex = assertThrows(AppException.class, call::run);
        assertEquals(code, ex.getErrorCode());
    }
}
