package com.aima.admin;

import com.aima.dto.request.AdminUpdateUserRequest;
import com.aima.dto.request.SubscriptionChangeRequest;
import com.aima.dto.request.SubscriptionExtendRequest;
import com.aima.dto.request.SubscriptionRevokeRequest;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SubscriptionHistoryResponse;
import com.aima.dto.response.UserSubscriptionResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.DurationUnit;
import com.aima.enums.PlanSource;
import com.aima.enums.SubscriptionChangeCategory;
import com.aima.enums.SubscriptionHistoryAction;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlanRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.AdminSubscriptionService;
import com.aima.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tab "Gói dịch vụ" của modal chi tiết người dùng chạy qua Spring context thật + H2: service,
 * repository (kể cả câu {@code SELECT … FOR UPDATE}), mapper và ranh giới transaction thật.
 * Job nền bị đẩy ra xa bằng cấu hình như {@code PaymentEndToEndTest}.
 */
@SpringBootTest(properties = {
        "payment.gateway=mock",
        "payment.reconcile-interval-ms=3600000",
        "payment.expiry-interval-ms=3600000",
        "payment.plan-expiry-cron=0 0 0 1 1 *",
        "aima.production-mode=false",
})
class AdminSubscriptionEndToEndTest {

    @Autowired
    private AdminSubscriptionService adminSubscriptionService;
    @Autowired
    private UserService userService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PlanRepository planRepository;

    private User newUser(String tag, String roleName) {
        Role role = roleRepository.findByRoleName(roleName).orElseThrow();
        String email = tag + "-" + UUID.randomUUID() + "@e2e.local";
        User user = User.builder()
                .username(email).email(email).fullName("E2E " + tag)
                .password("{noop}x").role(role).status(UserStatus.ACTIVE)
                .plan(UserPlan.FREE)
                .build();
        return userRepository.save(user);
    }

    private UUID planId(String code) {
        return planRepository.findByCodeAndDeletedAtIsNull(code).orElseThrow().getId();
    }

    private List<SubscriptionHistoryResponse> history(User user) {
        PageResponse<SubscriptionHistoryResponse> page =
                adminSubscriptionService.listHistory(user.getId(), 0, 10).getResult();
        return page.getContent();
    }

    @Test
    void grantThenExtend_accumulates_andEveryStepIsInTheHistory() {
        User admin = newUser("admin", "ADMIN");
        User user = newUser("u1", "USER");

        UserSubscriptionResponse granted = adminSubscriptionService.change(admin.getEmail(), user.getId(),
                SubscriptionChangeRequest.builder().planId(planId("PRO")).amount(1).unit(DurationUnit.MONTH)
                        .category(SubscriptionChangeCategory.SUPPORT).reason("Khách doanh nghiệp trả ngoài").build())
                .getResult();
        assertEquals("PRO", granted.getPlanCode());
        assertEquals(PlanSource.ADMIN, granted.getPlanSource());
        assertEquals(UserPlan.PRO, granted.getPlanLabel());
        LocalDateTime firstExpiry = granted.getPlanExpiresAt();

        UserSubscriptionResponse extended = adminSubscriptionService.extend(admin.getEmail(), user.getId(),
                SubscriptionExtendRequest.builder().amount(10).unit(DurationUnit.DAY)
                        .category(SubscriptionChangeCategory.PROMOTION).reason("Tặng dịp 2/9").build())
                .getResult();
        assertEquals(firstExpiry.plusDays(10).truncatedTo(ChronoUnit.SECONDS),
                extended.getPlanExpiresAt().truncatedTo(ChronoUnit.SECONDS), "gia hạn phải CỘNG DỒN vào hạn cũ");
        assertEquals(granted.getPlanStartedAt().truncatedTo(ChronoUnit.SECONDS),
                extended.getPlanStartedAt().truncatedTo(ChronoUnit.SECONDS));

        // Đọc lại độc lập: đúng như đã lưu, và nhãn User.plan khớp gói thật.
        UserSubscriptionResponse current = adminSubscriptionService.get(user.getId()).getResult();
        assertEquals("PRO", current.getPlanCode());
        assertEquals(UserPlan.PRO, userRepository.findById(user.getId()).orElseThrow().getPlan());

        List<SubscriptionHistoryResponse> rows = history(user);
        assertEquals(2, rows.size());
        SubscriptionHistoryResponse newest = rows.get(0);
        assertEquals(SubscriptionHistoryAction.ADMIN_EXTENDED, newest.getAction(), "mới nhất phải đứng đầu");
        assertEquals(admin.getEmail(), newest.getActorEmail());
        assertEquals(SubscriptionChangeCategory.PROMOTION, newest.getCategory());
        assertEquals("Tặng dịp 2/9", newest.getReason());
        assertEquals(10, newest.getExtendAmount());
        assertEquals(DurationUnit.DAY, newest.getExtendUnit());
        assertEquals(SubscriptionHistoryAction.ADMIN_CHANGED, rows.get(1).getAction());
        assertEquals("FREE", rows.get(1).getFromPlanCode());
    }

    @Test
    void revoke_returnsToFree_andRejectsASecondRevoke() {
        User admin = newUser("admin", "ADMIN");
        User user = newUser("u2", "USER");
        adminSubscriptionService.change(admin.getEmail(), user.getId(),
                SubscriptionChangeRequest.builder().planId(planId("PLUS")).noExpiry(true)
                        .category(SubscriptionChangeCategory.COMPENSATION).reason("Đền bù sự cố").build());

        UserSubscriptionResponse revoked = adminSubscriptionService.revoke(admin.getEmail(), user.getId(),
                SubscriptionRevokeRequest.builder().category(SubscriptionChangeCategory.OTHER)
                        .reason("Hết thời gian đền bù").build()).getResult();

        assertEquals("FREE", revoked.getPlanCode());
        assertEquals(PlanSource.FREE, revoked.getPlanSource());
        assertNull(revoked.getPlanExpiresAt());
        assertEquals(UserPlan.FREE, revoked.getPlanLabel());
        assertEquals(SubscriptionHistoryAction.ADMIN_REVOKED, history(user).get(0).getAction());

        AppException e = assertThrows(AppException.class, () -> adminSubscriptionService.revoke(
                admin.getEmail(), user.getId(), SubscriptionRevokeRequest.builder()
                        .category(SubscriptionChangeCategory.OTHER).reason("bấm lại").build()));
        assertEquals(ErrorCode.SUBSCRIPTION_ALREADY_FREE, e.getErrorCode());
    }

    @Test
    void changeWithoutDuration_isRejectedUnlessNoExpiry() {
        User admin = newUser("admin", "ADMIN");
        User user = newUser("u3", "USER");

        AppException e = assertThrows(AppException.class, () -> adminSubscriptionService.change(
                admin.getEmail(), user.getId(), SubscriptionChangeRequest.builder().planId(planId("PRO"))
                        .category(SubscriptionChangeCategory.OTHER).reason("thiếu hạn").build()));

        assertEquals(ErrorCode.SUBSCRIPTION_DURATION_INVALID, e.getErrorCode());
        assertTrue(history(user).isEmpty(), "thao tác bị từ chối không được để lại dòng lịch sử");
    }

    /** Nguyên nhân gốc của bug 25/9: PATCH /users chỉ ghi nhãn cache, lệch với subscription. */
    @Test
    void patchUser_withPlan_isRejected_andNothingChanges() {
        User admin = newUser("admin", "ADMIN");
        User user = newUser("u4", "USER");

        AppException e = assertThrows(AppException.class, () -> userService.updateUser(admin.getEmail(),
                user.getId(), AdminUpdateUserRequest.builder().fullName("Đổi tên").plan(UserPlan.PRO).build()));

        assertEquals(ErrorCode.USER_PLAN_UPDATE_NOT_ALLOWED, e.getErrorCode());
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(UserPlan.FREE, reloaded.getPlan());
        assertEquals("E2E u4", reloaded.getFullName(), "cả request bị từ chối, không lưu nửa vời");
    }

    @Test
    void patchUser_withoutPlan_stillWorks() {
        User admin = newUser("admin", "ADMIN");
        User user = newUser("u5", "USER");

        userService.updateUser(admin.getEmail(), user.getId(),
                AdminUpdateUserRequest.builder().fullName("Tên mới").build());

        assertEquals("Tên mới", userRepository.findById(user.getId()).orElseThrow().getFullName());
    }
}
