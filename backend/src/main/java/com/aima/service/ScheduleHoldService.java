package com.aima.service;

import com.aima.entity.ContentItem;
import com.aima.entity.PostSchedule;
import com.aima.enums.HoldReason;

import java.util.Collection;
import java.util.UUID;

/**
 * Nơi DUY NHẤT thêm/gỡ lý do tạm giữ của lịch (plan §2.2). Một lịch có thể bị giữ vì nhiều lý do cùng lúc;
 * mỗi luồng chỉ gỡ lý do mình quản lý. Lịch chỉ trở lại SCHEDULED khi hết mọi lý do và chưa quá giờ —
 * duyệt/kết nối lại muộn KHÔNG tự đăng.
 *
 * <p>Các hàm nhận entity yêu cầu caller đã khóa bài ({@link ContentItemStatusResolver#lock}) và tự gọi
 * {@code refresh} sau đó; các hàm hàng loạt tự khóa bài theo thứ tự id và tự tính lại trạng thái tổng.
 */
public interface ScheduleHoldService {

    /** Thêm lý do (lịch SCHEDULED → ON_HOLD). Chỉ áp cho lịch SCHEDULED/ON_HOLD; trả true nếu lý do mới được thêm. */
    boolean hold(PostSchedule schedule, HoldReason reason);

    /**
     * Gỡ lý do; {@code resume} = true thì lịch ON_HOLD hết lý do và giờ đăng còn ở tương lai → SCHEDULED.
     * Trả true nếu lý do có tồn tại.
     */
    boolean release(PostSchedule schedule, HoldReason reason, boolean resume);

    /** Bắt buộc duyệt bật + bài chưa APPROVED → giữ mọi lịch chưa đăng của bài; ngược lại gỡ PENDING_REVIEW. */
    void syncReviewHolds(ContentItem item);

    /**
     * Nội dung bài THỰC SỰ đổi (sửa tay, định dạng lại): bỏ hiệu lực phê duyệt cũ (APPROVED → NEED_REVIEW) dù
     * policy bật hay tắt; policy bật thì giữ mọi lịch chưa đăng của bài chờ duyệt lại. Caller đã khóa bài.
     */
    void onContentChanged(ContentItem item);

    /** Đổi policy duyệt của user: đồng bộ lại mọi bài có lịch chưa đăng (không bỏ sót lịch cũ). */
    void syncReviewHoldsForUser(UUID userId);

    int holdForAccounts(Collection<UUID> accountIds, HoldReason reason);

    /** Gỡ lý do cho lịch của các tài khoản (vd kết nối lại → ACCOUNT_ISSUE); trả số lịch trở lại SCHEDULED. */
    int releaseForAccounts(Collection<UUID> accountIds, HoldReason reason);

    /** Gỡ lý do cho mọi lịch của user; trả số lịch được gỡ lý do. */
    int releaseForUser(UUID userId, HoldReason reason, boolean resume);

    /** Bài của user có đang bắt buộc duyệt không (không có dòng settings = mặc định tắt). */
    boolean requiresApproval(UUID userId);
}
