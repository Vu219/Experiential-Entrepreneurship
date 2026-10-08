-- Mỗi user tối đa MỘT subscription còn hiệu lực (deleted_at IS NULL). SubscriptionServiceImpl.getOrCreate
-- trước đây kiểm "chưa có thì tạo" không khoá → hai request đầu tiên song song tạo HAI dòng, các truy vấn
-- Optional theo user_id sau đó nổ IncorrectResultSize. Code nay bắt DataIntegrityViolationException rồi đọc lại.
--
-- An toàn khi DB đã có dòng trùng: KHÔNG tự gộp/xoá (chọn dòng nào giữ là quyết định nghiệp vụ — gói trả
-- tiền, hạn dùng, lịch sử). Có trùng thì BỎ QUA tạo index + cảnh báo, migration vẫn qua để app khởi động;
-- dọn trùng bằng tay rồi chạy lại đúng câu CREATE UNIQUE INDEX IF NOT EXISTS bên dưới (migration sau).
-- Kiểm tra trước khi deploy:
--   SELECT user_id, count(*) FROM subscriptions WHERE deleted_at IS NULL GROUP BY user_id HAVING count(*) > 1;
DO $$
DECLARE
    duplicated bigint;
BEGIN
    SELECT count(*) INTO duplicated FROM (
        SELECT user_id FROM subscriptions WHERE deleted_at IS NULL GROUP BY user_id HAVING count(*) > 1
    ) d;
    IF duplicated > 0 THEN
        RAISE WARNING 'subscriptions: % user có nhiều subscription còn hiệu lực — BỎ QUA tạo uk_subscriptions_one_active_per_user, cần dọn trùng bằng tay', duplicated;
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uk_subscriptions_one_active_per_user
            ON subscriptions (user_id) WHERE deleted_at IS NULL;
    END IF;
END $$;
