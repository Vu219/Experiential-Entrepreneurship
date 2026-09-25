package com.aima.payment;

import com.aima.dto.request.CheckoutRequest;
import com.aima.dto.response.PaymentResponse;
import com.aima.entity.Role;
import com.aima.entity.User;
import com.aima.enums.MockPaymentOutcome;
import com.aima.enums.UserPlan;
import com.aima.enums.UserStatus;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.PlanRepository;
import com.aima.repository.RoleRepository;
import com.aima.repository.UserRepository;
import com.aima.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Rà soát bảo mật của toàn bộ bề mặt API thanh toán.
 *
 * <p>Bốn thứ được khẳng định ở đây, mỗi thứ là một cách mất tiền hoặc rò dữ liệu khác nhau:</p>
 * <ol>
 *   <li><b>Cách ly theo user</b> — user A không đọc/không thao tác được đơn của user B.</li>
 *   <li><b>Phân quyền admin</b> — user thường chạm vào {@code /admin/payments*} là 403,
 *       ẩn danh là 401.</li>
 *   <li><b>Cổng giả lập chết hẳn ngoài môi trường dev</b>, kể cả khi quên
 *       {@code AIMA_PRODUCTION_MODE}.</li>
 *   <li><b>{@code rawPayload} không có đường nào ra tới endpoint của user thường.</b></li>
 * </ol>
 *
 * <p>Context của lớp này chạy {@code payment.gateway=payos} có chủ đích — đó là cấu hình
 * production, và là điều kiện để kiểm mục (3) cho đúng thứ cần kiểm.</p>
 */
@SpringBootTest(properties = {
        "payment.gateway=payos",
        "payment.pending-ttl-minutes=15",
        "payment.grace-minutes=10",
        "payment.max-grace-rounds=3",
        "payment.webhook-max-body-bytes=16384",
        "payment.webhook-alert-threshold=5",
        "payment.webhook-alert-window-minutes=10",
        "payment.reconcile-interval-ms=3600000",
        "payment.expiry-interval-ms=3600000",
        "payment.plan-expiry-cron=0 0 0 1 1 *",
        // CỐ Ý để false: mục (3) phải đúng ngay cả khi người triển khai quên bật cờ production.
        "aima.production-mode=false",
})
class PaymentSecurityTest {

    @Autowired
    private WebApplicationContext webApplicationContext;
    @Autowired
    private PaymentService paymentService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PlanRepository planRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        // Dựng thủ công + springSecurity(): @WithMockUser bị SecurityContextHolderFilter
        // (STATELESS) ghi đè trong môi trường test — cùng lý do đã ghi ở AiConfigAdminTest.
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
    }

    private static RequestPostProcessor asUser(String email) {
        return SecurityMockMvcRequestPostProcessors.user(email).roles("USER");
    }

    private static RequestPostProcessor asAdmin() {
        return SecurityMockMvcRequestPostProcessors.user("admin@sec.local").roles("ADMIN");
    }

    private User newUser(String tag) {
        Role role = roleRepository.findByRoleName("USER").orElseThrow();
        String email = tag + "-" + UUID.randomUUID() + "@sec.local";
        return userRepository.save(User.builder()
                .username(email).email(email).fullName("Sec " + tag)
                .password("{noop}x").role(role).status(UserStatus.ACTIVE).plan(UserPlan.FREE)
                .build());
    }

    // ============================================================ (1) cách ly theo user

    @Test
    void userCannotReadAnotherUsersOrder() {
        User owner = newUser("owner");
        User intruder = newUser("intruder");
        UUID orderId = orderOf(owner);

        AppException e = assertThrows(AppException.class,
                () -> paymentService.get(intruder.getEmail(), orderId));

        assertEquals(ErrorCode.PAYMENT_ACCESS_DENIED, e.getErrorCode());
        assertEquals(403, e.getErrorCode().getStatusCode().value());
    }

    @Test
    void userCannotVerifyAnotherUsersOrder() {
        User owner = newUser("vowner");
        User intruder = newUser("vintruder");
        UUID orderId = orderOf(owner);

        // Nếu chỗ này lọt, kẻ tấn công có thể dò trạng thái đơn của người khác và — tệ hơn —
        // đẩy một đơn lạ đi qua luồng đối soát.
        AppException e = assertThrows(AppException.class,
                () -> paymentService.verify(intruder.getEmail(), orderId));

        assertEquals(ErrorCode.PAYMENT_ACCESS_DENIED, e.getErrorCode());
    }

    @Test
    void userCannotCancelAnotherUsersOrder() {
        User owner = newUser("cowner");
        User intruder = newUser("cintruder");
        UUID orderId = orderOf(owner);

        AppException e = assertThrows(AppException.class,
                () -> paymentService.cancel(intruder.getEmail(), orderId));

        assertEquals(ErrorCode.PAYMENT_ACCESS_DENIED, e.getErrorCode());
    }

    @Test
    void unknownOrderIsNotFound_notForbidden() {
        User user = newUser("nf");

        AppException e = assertThrows(AppException.class,
                () -> paymentService.get(user.getEmail(), UUID.randomUUID()));

        assertEquals(ErrorCode.PAYMENT_NOT_FOUND, e.getErrorCode());
    }

    @Test
    void userListOnlyContainsOwnOrders() {
        User owner = newUser("lowner");
        User other = newUser("lother");
        orderOf(owner);

        var page = paymentService.list(other.getEmail(), null, null, null, 0, 20).getResult();

        assertTrue(page.getContent().isEmpty(), "danh sách phải scope theo token, không theo tham số");
    }

    // ============================================================ (2) phân quyền admin

    @Test
    void adminEndpointsRejectPlainUsers() throws Exception {
        String email = newUser("rbac").getEmail();
        mockMvc.perform(get("/admin/payments").with(asUser(email))).andExpect(status().isForbidden());
        mockMvc.perform(get("/admin/payments/summary").with(asUser(email))).andExpect(status().isForbidden());
        mockMvc.perform(get("/admin/payments/" + UUID.randomUUID()).with(asUser(email)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/payments/" + UUID.randomUUID() + "/mark-paid")
                        .with(asUser(email)).contentType(APPLICATION_JSON).content("{\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        // Thao tác gói của một user đã chuyển sang AccountController (/users/{id}/subscription/*).
        String base = "/users/" + UUID.randomUUID() + "/subscription";
        mockMvc.perform(get(base).with(asUser(email))).andExpect(status().isForbidden());
        mockMvc.perform(get(base + "/history").with(asUser(email))).andExpect(status().isForbidden());
        mockMvc.perform(post(base + "/extend").with(asUser(email)).contentType(APPLICATION_JSON)
                        .content("{\"amount\":7,\"unit\":\"DAY\",\"category\":\"OTHER\",\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(base + "/change").with(asUser(email)).contentType(APPLICATION_JSON)
                        .content("{\"planId\":\"" + UUID.randomUUID()
                                + "\",\"noExpiry\":true,\"category\":\"OTHER\",\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(base + "/revoke").with(asUser(email)).contentType(APPLICATION_JSON)
                        .content("{\"category\":\"OTHER\",\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpointsRejectAnonymous() throws Exception {
        mockMvc.perform(get("/admin/payments")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/admin/payments/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminActionsRequireAReason() throws Exception {
        // Lý do rỗng phải bị chặn ở tầng validation, TRƯỚC khi chạm vào đơn nào.
        mockMvc.perform(post("/admin/payments/" + UUID.randomUUID() + "/cancel")
                        .with(asAdmin()).contentType(APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/admin/payments/" + UUID.randomUUID() + "/mark-paid")
                        .with(asAdmin()).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void userPaymentEndpointsRejectAnonymous() throws Exception {
        mockMvc.perform(get("/payments/billing")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/payments")).andExpect(status().isUnauthorized());
    }

    // ============================================================ (3) cổng giả lập

    @Test
    void mockOutcomeEndpointIsDeadWhenTheRealGatewayIsActive() {
        User user = newUser("mock");

        // AIMA_PRODUCTION_MODE đang TẮT trong context này — nghĩa là lớp khoá duy nhất còn lại
        // là "cổng đang bật phải là MOCK". Đó chính là điều cần khẳng định.
        AppException e = assertThrows(AppException.class, () -> paymentService.applyMockOutcome(
                user.getEmail(), UUID.randomUUID(), MockPaymentOutcome.SUCCESS));

        assertEquals(ErrorCode.PAYMENT_MOCK_DISABLED, e.getErrorCode());
        assertEquals(403, e.getErrorCode().getStatusCode().value());
    }

    @Test
    void mockEndpointStillRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/payments/mock/" + UUID.randomUUID() + "/success"))
                .andExpect(status().isUnauthorized());
    }

    // ============================================================ (4) rawPayload

    @Test
    void userFacingDtoHasNoFieldThatCouldCarryTheRawGatewayPayload() {
        // Kiểm CẤU TRÚC chứ không kiểm một response cụ thể: chừng nào DTO của user không có
        // trường nào như vậy thì rò rỉ là bất khả thi, không phụ thuộc vào việc ai đó nhớ.
        for (Field field : PaymentResponse.class.getDeclaredFields()) {
            String name = field.getName().toLowerCase();
            assertFalse(name.contains("payload") || name.contains("rawpayload")
                            || name.equals("note") || name.contains("reconcile"),
                    "PaymentResponse KHÔNG được mang dữ liệu đối soát nội bộ: " + field.getName());
        }
    }

    // ============================================================ tiện ích

    /**
     * Tạo một đơn cho user. Cổng đang là PAYOS mà thiếu credential nên {@code checkout} sẽ ném
     * {@code PAYMENT_GATEWAY_NOT_CONFIGURED} SAU khi đã ghi đơn PENDING — đúng thứ ta cần: một
     * đơn có thật trong DB để thử truy cập chéo.
     */
    private UUID orderOf(User owner) {
        UUID planId = planRepository.findByCodeAndDeletedAtIsNull("PRO").orElseThrow().getId();
        try {
            return paymentService.checkout(owner.getEmail(),
                    CheckoutRequest.builder().planId(planId).build()).getResult().getPaymentId();
        } catch (AppException expected) {
            return paymentService.list(owner.getEmail(), null, null, null, 0, 1)
                    .getResult().getContent().getFirst().getId();
        }
    }
}
