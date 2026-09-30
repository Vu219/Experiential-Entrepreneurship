-- Only legacy Vietnam wall-clock timestamps can be converted by this migration.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'app.timezone'
                   AND config_value IN ('Asia/Ho_Chi_Minh', 'Asia/Saigon')) THEN
        RAISE EXCEPTION 'Unknown legacy timezone: verify a database copy before converting publishing timestamps';
    END IF;
END $$;

ALTER TABLE post_schedules ALTER COLUMN scheduled_time TYPE timestamptz
    USING scheduled_time AT TIME ZONE 'Asia/Ho_Chi_Minh';
ALTER TABLE posts ALTER COLUMN published_at TYPE timestamptz
    USING published_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
ALTER TABLE posting_jobs ALTER COLUMN start_time TYPE timestamptz
    USING start_time AT TIME ZONE 'Asia/Ho_Chi_Minh';
ALTER TABLE posting_jobs ALTER COLUMN end_time TYPE timestamptz
    USING end_time AT TIME ZONE 'Asia/Ho_Chi_Minh';
ALTER TABLE posting_jobs ALTER COLUMN next_retry_at TYPE timestamptz
    USING next_retry_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
ALTER TABLE post_analytics ALTER COLUMN collected_at TYPE timestamptz
    USING collected_at AT TIME ZONE 'Asia/Ho_Chi_Minh';

CREATE TABLE user_publishing_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    timezone varchar(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    require_approval boolean NOT NULL DEFAULT false,
    conflict_window_minutes integer NOT NULL DEFAULT 60 CHECK (conflict_window_minutes >= 0),
    brand_voice_blocking_enabled boolean NOT NULL DEFAULT false,
    brand_voice_threshold integer CHECK (brand_voice_threshold BETWEEN 0 AND 100),
    CHECK (NOT brand_voice_blocking_enabled OR brand_voice_threshold IS NOT NULL)
);
INSERT INTO user_publishing_settings(user_id) SELECT id FROM users;
COMMENT ON COLUMN post_schedules.scheduled_time IS 'Absolute publishing instant. API requires ISO-8601 with Z or offset; display in user publishing timezone.';
COMMENT ON COLUMN posts.published_at IS 'Absolute publishing instant. Legacy values converted from Asia/Ho_Chi_Minh.';
-- BaseEntity/payment/usage wall clocks deliberately remain unchanged.
