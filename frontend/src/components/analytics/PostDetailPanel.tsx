import { type CSSProperties } from 'react';
import { Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { formatGroupedNumber, formatDateTimeVN } from '../../utils/format';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import { METRIC_COLOR } from './analyticsTokens';
import type { AnalyticsTopPost } from '../../api/analytics';

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
  const engagementRate = post.views > 0 ? ((totalInteractions / post.views) * 100) : null;

  const statItems: { icon: typeof Eye; label: string; value: number; color: string }[] = [
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
          <span style={{ fontSize: 12, fontWeight: 700, color: '#3f3a55' }}>
            {post.accountName || tag}
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: '#a59fbb', fontWeight: 500 }}>
          {formatDateTimeVN(post.publishedAt)}
        </span>
      </div>

      {/* 2. Main Title */}
      <div>
        <h4 style={{
          margin: 0, fontSize: compact ? 14.5 : 16, fontWeight: 700, color: '#1e1b2e', lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
        }}>
          {post.caption || t.schNoCaption}
        </h4>
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
                  background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <s.icon size={13} color={s.color} />
                </div>
                <span style={{ fontSize: 11.5, color: '#6b6680', fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1e1b2e', marginTop: 4 }}>
                {formatGroupedNumber(s.value, lang)}
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
              <span style={{ fontSize: 11.5, color: '#8a85a0', fontWeight: 500 }}>{t.anaAvgEngRate}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                {engagementRate.toFixed(2)}%
              </span>
            </div>
          )}
          <div style={perfRow}>
            <span style={{ fontSize: 11.5, color: '#8a85a0', fontWeight: 500 }}>{t.pdpTotalInteractions ?? 'Tổng tương tác'}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1e1b2e' }}>
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
            margin: 0, fontSize: 12.5, color: '#5b5670', lineHeight: 1.55,
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
              background: brandGradient, color: '#fff',
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px -3px rgba(124, 58, 237, 0.4)',
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
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
  color: '#8a85a0',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 8,
};

const metricCard: CSSProperties = {
  background: '#f8f6fc',
  borderRadius: 12,
  padding: '11px 13px',
  border: '1px solid #efeaf8',
};

const perfRow: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 14px',
  background: '#f8f6fc',
  borderRadius: 10,
  border: '1px solid #efeaf8',
};
