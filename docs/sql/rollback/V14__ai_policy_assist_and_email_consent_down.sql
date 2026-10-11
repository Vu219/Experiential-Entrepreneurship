-- Rollback V14__ai_policy_assist_and_email_consent (chạy tay, SAU KHI đã chuyển binary về bản trước V14).
-- Mất dữ liệu: đồng ý nhận email của người dùng, toggle kiểm tra chính sách, lịch sử tác vụ AI sửa/kiểm tra.
-- Event usage của 2 task mới (ai_usage/usage_* với task_code POLICY_FIX/POLICY_CHECK) bị XOÁ để CHECK cũ áp lại được —
-- token đã trừ của user vẫn giữ trong users.tokens_used (cache), reconcile sau rollback sẽ bỏ phần này.
BEGIN;

DELETE FROM usage_hourly WHERE task_code IN ('POLICY_FIX','POLICY_CHECK');
DELETE FROM usage_daily WHERE task_code IN ('POLICY_FIX','POLICY_CHECK');
DELETE FROM ai_usage WHERE task_code IN ('POLICY_FIX','POLICY_CHECK');
DELETE FROM billing_rates WHERE task_code IN ('POLICY_FIX','POLICY_CHECK');
DELETE FROM ai_task_routing_fallback WHERE routing_id IN
    (SELECT id FROM ai_task_routing WHERE task_code IN ('POLICY_FIX','POLICY_CHECK'));
DELETE FROM ai_task_routing WHERE task_code IN ('POLICY_FIX','POLICY_CHECK');

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['ai_task_routing','ai_usage','billing_rates','usage_daily','usage_hourly']
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_task_code_check');
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (task_code IN (''CONTENT_GENERATION'','
            || '''PLATFORM_FORMATTING'',''TREND_RESEARCH'',''GOLDEN_HOURS'',''STRATEGY_OPTIMIZATION'','
            || '''CONTENT_REGENERATION''))', t, t || '_task_code_check');
    END LOOP;
END $$;

DROP TABLE IF EXISTS ai_assist_jobs;
ALTER TABLE user_publishing_settings DROP COLUMN IF EXISTS policy_check_enabled;
DROP TABLE IF EXISTS user_notification_preferences;

DELETE FROM flyway_schema_history WHERE version = '14';

COMMIT;
