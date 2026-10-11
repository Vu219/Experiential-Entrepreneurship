-- Giới hạn AI hỗ trợ chính sách theo TỪNG GÓI (admin chỉnh ở "Quản lý gói") thay cho env cứng theo tên gói
-- AIMA_POLICY_CHECK_AI_LIMIT_FREE/PLUS/PRO. Quy ước: NULL = dùng mặc định hệ thống (env), -1 = không giới hạn,
-- 0 = tắt, > 0 = số lượt. CHỈ THÊM cột — binary cũ vẫn chạy trên schema mới.
-- Rollback: docs/sql/rollback/V15__plan_ai_assist_limits_down.sql

ALTER TABLE plans ADD COLUMN policy_check_ai_monthly_limit integer
    CONSTRAINT plans_policy_check_ai_monthly_limit_check CHECK (policy_check_ai_monthly_limit >= -1);
ALTER TABLE plans ADD COLUMN ai_fix_max_per_version integer
    CONSTRAINT plans_ai_fix_max_per_version_check CHECK (ai_fix_max_per_version >= -1);

-- Backfill đúng giá trị env đang chạy (FREE 0 / PLUS 30 / PRO 200) để hành vi không đổi sau deploy.
-- ai_fix_max_per_version để NULL: trước đây là một giá trị chung cho mọi gói (AIMA_AI_FIX_MAX_PER_VERSION),
-- nay vẫn là mặc định hệ thống — giữ nguyên hành vi.
UPDATE plans SET policy_check_ai_monthly_limit = 0 WHERE code = 'FREE' AND policy_check_ai_monthly_limit IS NULL;
UPDATE plans SET policy_check_ai_monthly_limit = 30 WHERE code = 'PLUS' AND policy_check_ai_monthly_limit IS NULL;
UPDATE plans SET policy_check_ai_monthly_limit = 200 WHERE code = 'PRO' AND policy_check_ai_monthly_limit IS NULL;
