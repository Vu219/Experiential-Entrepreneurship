package com.aima.admin;

import com.aima.dto.request.PlanCreateRequest;
import com.aima.dto.request.PlanUpdateRequest;
import com.aima.entity.Plan;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.PlanMapperImpl;
import com.aima.repository.PlanFeatureRepository;
import com.aima.repository.PlanRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.Impl.PlanServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Hạn mức token THẬT ({@code Plan.monthlyTokenLimit}, null = không giới hạn) của gói admin tạo/sửa:
 * trước đây không DTO nào set được nên mọi gói admin tạo đều thành gói "vô hạn".
 */
class PlanTokenLimitTest {

    private PlanRepository planRepository;
    private PlanServiceImpl service;

    @BeforeEach
    void setUp() {
        planRepository = mock(PlanRepository.class);
        when(planRepository.save(any())).thenAnswer(inv -> {
            Plan p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
        service = new PlanServiceImpl(mock(ActivityLogService.class), planRepository,
                mock(PlanFeatureRepository.class), new PlanMapperImpl());
    }

    private static PlanCreateRequest create(long price, Long limit) {
        return PlanCreateRequest.builder().code("team").nameVi("Team").nameEn("Team")
                .price(price).billingIntervalMonths((short) 1).monthlyTokenLimit(limit).build();
    }

    @Test
    void create_sellablePlanWithLimit_storesTheRealLimit() {
        service.create(create(999_000L, 250_000L));

        verify(planRepository).save(argThat(p -> Long.valueOf(250_000L).equals(p.getMonthlyTokenLimit())));
    }

    @Test
    void create_sellablePlanWithoutLimit_isRejected() {
        AppException e = assertThrows(AppException.class, () -> service.create(create(999_000L, null)));

        assertEquals(ErrorCode.PLAN_TOKEN_LIMIT_REQUIRED, e.getErrorCode());
        verify(planRepository, never()).save(any());
    }

    @Test
    void create_freePlanWithoutLimit_isAllowed() {
        assertDoesNotThrow(() -> service.create(create(0L, null)));
    }

    /** FE cũ chưa gửi monthlyTokenLimit: PUT không được xoá hạn mức đang có (null = giữ nguyên). */
    @Test
    void update_withoutLimit_keepsExistingLimit() {
        Plan plan = Plan.builder().code("PLUS").nameVi("Plus").nameEn("Plus").price(99_000L)
                .monthlyTokenLimit(100_000L).isActive(true).build();
        plan.setId(UUID.randomUUID());
        when(planRepository.findByIdAndDeletedAtIsNull(plan.getId())).thenReturn(Optional.of(plan));

        service.update(plan.getId(), PlanUpdateRequest.builder().nameVi("Plus").nameEn("Plus").price(129_000L)
                .billingIntervalMonths((short) 1).highlight(false).displayOrder(1).isActive(true).build());

        assertEquals(100_000L, plan.getMonthlyTokenLimit());
        assertEquals(129_000L, plan.getPrice());
    }

    @Test
    void update_activatingPaidPlanWithoutLimit_isRejected() {
        Plan plan = Plan.builder().code("TEAM").nameVi("Team").nameEn("Team").price(0L).isActive(false).build();
        plan.setId(UUID.randomUUID());
        when(planRepository.findByIdAndDeletedAtIsNull(plan.getId())).thenReturn(Optional.of(plan));

        AppException e = assertThrows(AppException.class, () -> service.update(plan.getId(),
                PlanUpdateRequest.builder().nameVi("Team").nameEn("Team").price(999_000L)
                        .billingIntervalMonths((short) 1).highlight(false).displayOrder(1).isActive(true).build()));

        assertEquals(ErrorCode.PLAN_TOKEN_LIMIT_REQUIRED, e.getErrorCode());
    }
}
