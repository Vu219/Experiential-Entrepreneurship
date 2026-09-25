package com.aima.repository;

import com.aima.entity.Payment;
import com.aima.entity.User;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Bộ lọc bảng đơn hàng admin ({@code GET /admin/payments}) dựng bằng predicate CÓ ĐIỀU KIỆN:
 * tham số lọc null/rỗng thì mệnh đề tương ứng KHÔNG được sinh ra trong SQL.
 *
 * <p><b>Vì sao không dùng mẫu {@code (:x is null or ...)}</b> (dính 2026-09-25): khi {@code q}
 * null, JDBC gửi null không kèm kiểu, PostgreSQL suy ra {@code bytea} cho biểu thức nối chuỗi
 * rồi nổ {@code function lower(bytea) does not exist} (42883). H2 khoan dung hơn nên test không
 * bắt được. Mẫu {@code OR ? IS NULL} còn khiến planner khó dùng index vì phải lập một kế hoạch
 * chung cho cả hai trường hợp null/không null.</p>
 */
public final class PaymentSpecifications {

    /** Ký tự escape của LIKE — khai báo tường minh ở {@code cb.like(..., ESCAPE)}. */
    static final char LIKE_ESCAPE = '\\';

    private PaymentSpecifications() {
    }

    public static Specification<Payment> adminSearch(PaymentStatus status, PaymentGateway gateway,
                                                     Boolean reconcileRequired, LocalDateTime from,
                                                     LocalDateTime to, String q) {
        List<Specification<Payment>> specs = new ArrayList<>();
        specs.add((root, query, cb) -> cb.isNull(root.get("deletedAt")));
        if (status != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (gateway != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("gateway"), gateway));
        }
        if (reconcileRequired != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("reconcileRequired"), reconcileRequired));
        }
        if (from != null) {
            specs.add((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("orderedAt"), from));
        }
        if (to != null) {
            specs.add((root, query, cb) -> cb.lessThan(root.get("orderedAt"), to));
        }
        String search = normalizeSearch(q);
        if (search != null) {
            String pattern = "%" + escapeLike(search.toLowerCase()) + "%";
            specs.add((root, query, cb) -> {
                Join<Payment, User> user = root.join("user", JoinType.INNER);
                return cb.or(
                        cb.like(cb.lower(root.get("invoiceNo")), pattern, LIKE_ESCAPE),
                        cb.like(cb.lower(root.get("gatewayTxnId")), pattern, LIKE_ESCAPE),
                        cb.like(cb.lower(user.get("email")), pattern, LIKE_ESCAPE));
            });
        }
        return Specification.allOf(specs);
    }

    /** Trim; chuỗi rỗng/toàn khoảng trắng coi như không tìm. */
    static String normalizeSearch(String q) {
        if (q == null) {
            return null;
        }
        String trimmed = q.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Escape {@code \ % _} để từ khoá được so khớp NGUYÊN VĂN, không thành ký tự đại diện. */
    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
