package com.aima.service;

import com.aima.entity.PlatformAccount;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Đồng bộ số liệu CẤP TÀI KHOẢN (docs/analytics-real-data-plan.md giai đoạn 2, mục D.6): quét danh sách bài của
 * Trang (import bài người dùng tự đăng ngoài AIMA → {@code platform_media.origin = EXTERNAL}), insights theo ngày
 * ({@code account_insights_daily}) và Trang có liên kết Instagram Business hay không. Gọi nền tảng qua
 * {@link PlatformMetricsProvider} / {@link MetaApiClient}, KHÔNG giữ transaction quanh HTTP (rule #24).
 */
public interface AnalyticsAccountSyncService {

    /** Kênh đăng đến hạn đồng bộ cấp tài khoản (chỉ nền tảng có adapter hỗ trợ). */
    List<UUID> findDue(Instant now, int limit);

    /** Đồng bộ MỘT kênh đăng. {@code false} = bị nền tảng giới hạn tần suất → dừng cả lượt quét. */
    boolean sync(UUID accountId);

    /** Nút "Làm mới": đưa kênh đăng của user về hạn ngay. Trả số kênh được xếp lịch. */
    int requestSync(UUID userId);

    /**
     * Ghi Trang có / không có Instagram Business liên kết (gọi trong transaction của OAuth callback). Chỉ
     * Trang Facebook; {@code linked} null = không tra được, giữ nguyên trạng thái cũ.
     */
    void recordInstagramLink(PlatformAccount page, Boolean linked);

    /**
     * Đăng ký app nhận webhook "feed" của Trang ({@code subscribed_apps}, giai đoạn 3) nếu chưa đăng ký. Gọi SAU commit của
     * OAuth callback (không giữ transaction quanh HTTP); thất bại (thường thiếu pages_manage_metadata) chỉ ghi
     * {@code webhook_error_code} — lượt đồng bộ cấp kênh sau tự thử lại.
     */
    void ensureWebhookSubscribed(UUID accountId);

    /**
     * Webhook báo Trang có bài mới → đưa các kênh Trang đó (mọi user AIMA đã kết nối) về hạn quét ngay. Gọi trong
     * transaction của worker webhook. Trả số kênh được xếp lịch.
     */
    int markDueForPage(String pageId);

    /**
     * Kết nối lại (OAuth tạo dòng platform_accounts MỚI vì dòng cũ đã xoá mềm khi ngắt kết nối): chuyển các bài đang theo
     * dõi của kết nối cũ cùng user + cùng tài khoản nền tảng sang kết nối mới, để lịch sử số liệu và liên kết bài AIMA không
     * bị mất / không tạo bản "Ngoài AIMA" trùng. Bài trùng ID → gộp: giữ bản gắn bài AIMA (nếu có), không thì bản cũ nhất;
     * snapshot của bản bị gộp chuyển sang bản giữ lại, bản giữ lại được đồng bộ lại ngay để tính lại số theo ngày.
     * Chỉ ghi DB (gọi trong transaction của OAuth callback). Trả số bài đã chuyển/gộp.
     */
    int adoptPreviousConnections(PlatformAccount account);

    /** Dev-seed: kết nối MẪU không có tài khoản thật trên nền tảng → không bao giờ tự đồng bộ. */
    void disableForAccounts(Collection<PlatformAccount> accounts);
}
