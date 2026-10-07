import { type CSSProperties } from 'react';
import { Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { formatGroupedNumber, formatDateTimeVN } from '../../utils/format';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import { METRIC_COLOR } from './analyticsTokens';
import type { AnalyticsTopPost } from '../../api/analytics';
import { C, alpha } from '../../styles/colors';
import MetricValue from './MetricValue';
import PostOriginBadges from './PostOriginBadges';

/**
 * Component hiển thị chi tiết bài viết (dùng trong modal hoặc widget tương lai).
 * Bao gồm: Header (nền tảng + ngày), Tiêu đề, Lưới thống kê 2x2, Hiệu suất, Tóm tắt & Nút hành động.
 */
export default function PostDetailPanel({
  post,
  onAction,
  actionLabel,
  compact = false,
}: {
  post: AnalyticsTopPost;
  /** Callback bấm nút primary bên dưới. */
  onAction?: (post: AnalyticsTopPost) => void;
  actionLabel?: string;
  compact?: boolean;
}) {
  const { t, lang, brandGradient } = useApp();
  const tag = PLATFORM_TO_TAG[post.platform] ?? 'FB';
  const totalInteractions = post.likes + post.comments + post.shares;
  const engagementRate = post.views ? ((totalInteractions / post.views) * 100) : null;

  const statItems: { icon: typeof Eye; label: string; value: number | null; color: string }[] = [
    { icon: Eye, label: t.anaViews, value: post.views, color: METRIC_COLOR.views },
    { icon: Heart, label: t.anaLikes, value: post.likes, color: METRIC_COLOR.likes },
    { icon: MessageCircle, label: t.anaComments, value: post.comments, color: METRIC_COLOR.comments },
    { icon: Share2, label: t.anaShares, value: post.shares, color: METRIC_COLOR.shares },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 14 : 18 }}>
      {/* 1. Header: Platform Badge + Published Date & Account */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={26} radius={7} fontSize={11} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            {post.accountName || tag}
            <PostOriginBadges post={post} />
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: C.textFaint, fontWeight: 500 }}>
          {formatDateTimeVN(post.publishedAt)}
        </span>
      </div>

      {/* 2. Main Title */}
      <div>
        <h4 style={{
          margin: 0, fontSize: compact ? 14.5 : 16, fontWeight: 700, color: C.ink900, lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
        }}>
          {post.caption || t.schNoCaption}
        </h4>
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
            fontSize: 12.5, fontWeight: 700, color: C.primary, textDecoration: 'none',
          }}>
            {t.anaOpenOnPlatform}
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* 3. 2x2 Metric Grid (Statistics) */}
      <div>
        <div style={sectionHeading}>
          {t.pdpStatistics ?? 'Thống kê tương tác'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {statItems.map((s) => (
            <div key={s.label} style={metricCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: alpha(s.color, 20 / 255), display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <s.icon size={13} color={s.color} />
                </div>
                <span style={{ fontSize: 11.5, color: C.textSecondary, fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.ink900, marginTop: 4 }}>
                <MetricValue value={s.value} post={post} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Performance Metrics */}
      <div>
        <div style={sectionHeading}>
          {t.pdpPerformance ?? 'Hiệu suất bài viết'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {engagementRate !== null && (
            <div style={perfRow}>
              <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>{t.anaAvgEngRate}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>
                {engagementRate.toFixed(2)}%
              </span>
            </div>
          )}
          <div style={perfRow}>
            <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>{t.pdpTotalInteractions ?? 'Tổng tương tác'}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.ink900 }}>
              {formatGroupedNumber(totalInteractions, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Summary / Excerpt */}
      {post.caption && (
        <div>
          <div style={sectionHeading}>
            {t.pdpSummary ?? 'Tóm tắt nội dung'}
          </div>
          <p style={{
            margin: 0, fontSize: 12.5, color: C.ink550, lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {post.caption}
          </p>
        </div>
      )}

      {/* 6. Action Button (Optional) */}
      {onAction && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={() => onAction(post)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', borderRadius: 12, padding: '12px 18px',
              background: brandGradient, color: C.onBrand,
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 4px 14px -3px ${C.legacyShadowrgba1245823704_}`,
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            className={"dm-hover-a29de51"}


          >
            {actionLabel || t.anaPostDetail}
            <ExternalLink size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

const sectionHeading: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 8,
};

const metricCard: CSSProperties = {
  background: C.bg,
  borderRadius: 12,
  padding: '11px 13px',
  border: `1px solid ${C.border}`,
};

const perfRow: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 14px',
  background: C.bg,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
};
