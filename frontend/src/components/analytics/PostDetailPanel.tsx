import { type CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { formatGroupedNumber, formatDateTimeVN } from '../../utils/format';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import type { AnalyticsTopPost } from '../../api/analytics';
import { C } from '../../styles/colors';
import PostOriginBadges from './PostOriginBadges';

/**
 * Cột "Nội dung bài viết" của modal Chi tiết bài viết: nền tảng + tài khoản + ngày đăng, caption (khung giới hạn
 * chiều cao, cuộn bên trong khi dài — modal không bị kéo dài theo caption), link mở bài trên nền tảng và 2 chỉ số
 * hiệu suất (tỷ lệ tương tác, tổng tương tác). Số liệu từng chỉ số + so sánh trung bình nằm ở cột còn lại.
 */
export default function PostDetailPanel({ post }: { post: AnalyticsTopPost }) {
  const { t, lang } = useApp();
  const tag = PLATFORM_TO_TAG[post.platform] ?? 'FB';
  const totalInteractions = post.likes + post.comments + post.shares;
  const engagementRate = post.views ? ((totalInteractions / post.views) * 100) : null;
  const viewLabel = t.anaViewOnPlatform.replace('{p}', PLATFORM_NAME[tag] ?? tag);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 16, padding: 16 }}>
      <div style={sectionHeading}>{t.pdpContent}</div>

      {/* Nền tảng + tài khoản + ngày đăng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={34} radius={9} fontSize={12} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.accountName || tag}
            <PostOriginBadges post={post} />
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{formatDateTimeVN(post.publishedAt)}</div>
        </div>
      </div>

      {/* Caption — cuộn bên trong khi dài */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px',
        maxHeight: 230, overflowY: 'auto',
        fontSize: 14, lineHeight: 1.6, color: C.ink750, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      }}>
        {post.caption || t.schNoCaption}
      </div>

      {/* Nút xem bài trên nền tảng — luôn hiện (trừ bài đã bị xoá): chưa có permalink (bài Threads, bài Facebook
          chưa tới lượt quét danh sách bài của Trang, dữ liệu mẫu) thì hiện mờ kèm lý do thay vì biến mất. */}
      {post.platformStatus === 'DELETED' ? (
        <p style={{ margin: 0, padding: '8px 10px', borderRadius: 8, background: C.slateTint, fontSize: 12, lineHeight: 1.5, color: C.textSecondary }}>
          {t.anaDeletedNote}
        </p>
      ) : post.permalink ? (
        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="btn-soft" style={viewBtn}>
          {viewLabel}
          <ExternalLink size={15} />
        </a>
      ) : (
        <div>
          <span aria-disabled="true" title={t.anaNoPermalink} style={{ ...viewBtn, opacity: 0.5, cursor: 'not-allowed' }}>
            {viewLabel}
            <ExternalLink size={15} />
          </span>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>{t.anaNoPermalink}</div>
        </div>
      )}

      {/* Hiệu suất */}
      <div>
        <div style={{ ...sectionHeading, marginBottom: 8 }}>{t.pdpPerformance}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {engagementRate !== null && (
            <div style={perfBox}>
              <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>{t.anaAvgEngRate}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{engagementRate.toFixed(2)}%</span>
            </div>
          )}
          <div style={perfBox}>
            <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>{t.pdpTotalInteractions}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.ink900 }}>{formatGroupedNumber(totalInteractions, lang)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const PLATFORM_NAME: Record<string, string> = { FB: 'Facebook', IG: 'Instagram', TH: 'Threads' };

const viewBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
  padding: '11px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface,
  fontSize: 13.5, fontWeight: 700, color: C.primary, textDecoration: 'none',
};

export const sectionHeading: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
};

const perfBox: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 14px',
  background: C.surface,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
};
