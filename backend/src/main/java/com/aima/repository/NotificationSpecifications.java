package com.aima.repository;

import com.aima.entity.Notification;
import com.aima.enums.NotificationType;
import org.springframework.data.jpa.domain.Specification;

import java.util.Collection;
import java.util.UUID;

/**
 * Bộ lọc danh sách thông báo ({@code GET /notifications}) bằng predicate CÓ ĐIỀU KIỆN — tham số null thì không sinh
 * mệnh đề (tránh mẫu {@code (:x is null or ...)} nổ trên PostgreSQL, xem {@link PaymentSpecifications}).
 */
public final class NotificationSpecifications {

    private NotificationSpecifications() {
    }

    public static Specification<Notification> forUser(UUID userId, boolean unreadOnly, Collection<NotificationType> types) {
        Specification<Notification> spec = (root, query, cb) -> cb.and(
                cb.equal(root.get("user").get("id"), userId),
                cb.isNull(root.get("deletedAt")));
        if (unreadOnly) {
            spec = spec.and((root, query, cb) -> cb.isNull(root.get("readAt")));
        }
        if (types != null) {
            spec = spec.and((root, query, cb) -> root.get("type").in(types));
        }
        return spec;
    }
}
