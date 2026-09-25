package com.aima.service;

import com.aima.dto.request.SubscriptionChangeRequest;
import com.aima.dto.request.SubscriptionExtendRequest;
import com.aima.dto.request.SubscriptionRevokeRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.SubscriptionHistoryResponse;
import com.aima.dto.response.UserSubscriptionResponse;

import java.util.UUID;

/**
 * Admin xem và thao tác gói của MỘT user (tab "Gói dịch vụ" trong modal chi tiết người dùng).
 * Quy tắc nghiệp vụ nằm ở {@link SubscriptionService}; lớp này tra cứu, khoá dòng, dựng
 * response và để lại vết {@code activity_logs}. Lịch sử gói ghi ở {@code SubscriptionService}
 * trong cùng transaction.
 */
public interface AdminSubscriptionService {

    ApiResponse<UserSubscriptionResponse> get(UUID userId);

    ApiResponse<PageResponse<SubscriptionHistoryResponse>> listHistory(UUID userId, int page, int size);

    /** Cộng dồn thời hạn vào gói hiện tại (giữ gói + nguồn gốc). */
    ApiResponse<UserSubscriptionResponse> extend(String actorEmail, UUID userId, SubscriptionExtendRequest request);

    /** Chuyển sang gói khác, thời hạn tính từ bây giờ hoặc không hết hạn. */
    ApiResponse<UserSubscriptionResponse> change(String actorEmail, UUID userId, SubscriptionChangeRequest request);

    /** Thu hồi — hạ về Free ngay. */
    ApiResponse<UserSubscriptionResponse> revoke(String actorEmail, UUID userId, SubscriptionRevokeRequest request);
}
