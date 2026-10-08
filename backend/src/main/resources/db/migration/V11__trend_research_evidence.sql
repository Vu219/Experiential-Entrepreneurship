-- Trend research dựa trên bằng chứng (2026-10): mỗi trend có loại, đà (momentum), hạn đăng,
-- hashtag, nguồn bằng chứng thật và độ tin cậy; ý tưởng giữ gợi ý triển khai + mục tiêu
-- (trước đây AI trả về nhưng bị bỏ); phiên lưu nguồn dữ liệu đã dùng và nguồn kích hoạt.

alter table trends
    add column relevance varchar(20) check (relevance in ('LOW','MEDIUM','HIGH')),
    add column trend_type varchar(20) check (trend_type in ('EVENT','NEWS','FORMAT','NICHE')),
    add column momentum varchar(20) check (momentum in ('NEW','RISING','STABLE','FADING')),
    add column act_by date,
    add column confidence varchar(20) check (confidence in ('LOW','MEDIUM','HIGH')),
    add column hashtags jsonb,
    add column evidence jsonb;

alter table content_ideas
    add column execution_suggestions jsonb,
    add column related_goals jsonb;

alter table trend_research_sessions
    add column grounded boolean,
    add column web_searches integer,
    add column data_sources jsonb,
    add column trigger_type varchar(20) not null default 'MANUAL' check (trigger_type in ('MANUAL','SCHEDULED'));

-- Lấy "trend đã gợi ý gần đây" theo brand + nền tảng (momentum / tránh lặp) và quét phiên kẹt.
create index if not exists idx_trs_brand_platform_time on trend_research_sessions (brand_profile_id, platform, research_time desc);
create index if not exists idx_trs_status_updated on trend_research_sessions (status, updated_at);
