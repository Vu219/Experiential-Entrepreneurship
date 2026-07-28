import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import PostDetailPanel from './PostDetailPanel';
import { formatDateTimeVN, formatGroupedNumber } from '../../utils/format';
import type { AnalyticsTopPost } from '../../api/analytics';

/**
 * Modal chi tiết bài viết khi người dùng click vào một dòng bài viết.
 * Hiển thị thông tin chi tiết bài viết (PostDetailPanel) kèm bảng So Sánh Với Mức Trung Bình (Comparison with Average).
 *
 * Tính toán trung bình dựa trên tập dữ liệu `allPosts` có sẵn trong bộ nhớ mà không cần gọi API phụ.
 */
export default function PostDetailModal({
  postId,
  fallback,
  allPosts = [],
  averageMetrics,
  onClose,
}: {
  postId: string;
  /** Số liệu sẵn có từ dòng bảng. */
  fallback: { caption: string | null; platform: string; publishedAt: string; views: number; likes: number; comments: number; shares: number };
  /** Danh sách toàn bộ bài viết sẵn có trong bộ nhớ để tính giá trị trung bình. */
  allPosts?: AnalyticsTopPost[];
  /** Giá trị trung bình truyền trực tiếp (nếu có). */
  averageMetrics?: { views: number; likes: number; comments: number; shares: number } | null;
  onClose: () => void;
}) {
  const { t, lang } = useApp();

  // Reconstruct full post object for PostDetailPanel
  const activePost: AnalyticsTopPost = {
    postId,
    contentItemId: null,
    platform: fallback.platform as any,
    caption: fallback.caption,
    accountName: null,
    publishedAt: fallback.publishedAt,
    views: fallback.views,
    likes: fallback.likes,
    comments: fallback.comments,
    shares: fallback.shares,
    engagement: fallback.likes + fallback.comments + fallback.shares,
  };

  // Compute average metrics from dataset loaded in memory
  const avg = useMemo(() => {
    if (averageMetrics) return averageMetrics;
    if (!allPosts || allPosts.length === 0) return null;
    const count = allPosts.length;
    return {
      views: Math.round(allPosts.reduce((sum, p) => sum + (p.views || 0), 0) / count),
      likes: Math.round(allPosts.reduce((sum, p) => sum + (p.likes || 0), 0) / count),
      comments: Math.round(allPosts.reduce((sum, p) => sum + (p.comments || 0), 0) / count),
      shares: Math.round(allPosts.reduce((sum, p) => sum + (p.shares || 0), 0) / count),
    };
  }, [averageMetrics, allPosts]);

  // Construct comparison data
  const comparisonRows = useMemo(() => {
    if (!avg) return null;
    const metrics: { key: 'views' | 'likes' | 'comments' | 'shares'; label: string }[] = [
      { key: 'views', label: t.anaViews },
      { key: 'likes', label: t.anaLikes },
      { key: 'comments', label: t.anaComments },
      { key: 'shares', label: t.anaShares },
    ];

    return metrics.map((m) => {
      const cur = fallback[m.key] || 0;
      const mean = avg[m.key] || 0;

      let tone: 'up' | 'down' | 'neutral' = 'neutral';
      let diffLabel = '0%';

      if (mean === 0) {
        if (cur > 0) {
          tone = 'up';
          diffLabel = '+100% ↑';
        } else {
          tone = 'neutral';
          diffLabel = '0%';
        }
      } else {
        const pct = Math.round(((cur - mean) / mean) * 100);
        if (pct > 0) {
          tone = 'up';
          diffLabel = `+${pct}% ↑`;
        } else if (pct < 0) {
          tone = 'down';
          diffLabel = `${pct}% ↓`;
        } else {
          tone = 'neutral';
          diffLabel = '0%';
        }
      }

      return {
        key: m.key,
        label: m.label,
        current: cur,
        avg: mean,
        diffLabel,
        tone,
      };
    });
  }, [avg, fallback, t]);

  return (
    <Modal
      title={t.anaPostDetail}
      subtitle={formatDateTimeVN(activePost.publishedAt)}
      onClose={onClose}
      maxWidth={900}
      animateScale
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Post Detail Panel */}
        <PostDetailPanel post={activePost} />

        {/* Section: Comparison with Average */}
        <div style={{ background: '#faf9fe', borderRadius: 16, padding: '18px 20px', border: '1px solid #f1eef8' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#211c38', marginBottom: 12 }}>
            {t.anaVsAverage ?? 'So sánh với mức trung bình'}
          </div>

          {!comparisonRows ? (
            <div style={{ fontSize: 13, color: '#8a85a0', padding: '8px 0' }}>
              {t.anaVsAverageEmpty ?? 'Chưa có đủ dữ liệu để so sánh với mức trung bình.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ece8f6' }}>
                    <th style={{ ...headCell, textAlign: 'left' }}>{t.colMetric ?? 'Chỉ số'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colCurrentPost ?? 'Bài viết này'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colAverage ?? 'Trung bình'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colDifference ?? 'Chênh lệch'}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.key} style={{ borderTop: '1px solid #f1eef8' }}>
                      <td style={{ ...cell, fontWeight: 600, color: '#2b2543' }}>{row.label}</td>
                      <td style={numCell}>{formatGroupedNumber(row.current, lang)}</td>
                      <td style={{ ...numCell, color: '#6b6680' }}>{formatGroupedNumber(row.avg, lang)}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                          ...(row.tone === 'up' ? pillUp : row.tone === 'down' ? pillDown : pillNeutral),
                        }}>
                          {row.diffLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

const headCell = { fontSize: 12, fontWeight: 600, color: '#8a85a0', padding: '10px 8px', whiteSpace: 'nowrap' } as const;
const cell = { padding: '12px 8px', fontSize: 13, color: '#5b5670', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;
const numCell = { padding: '12px 8px', fontSize: 13.5, fontWeight: 700, color: '#1e1b2e', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;

const pillUp = { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' } as const;
const pillDown = { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' } as const;
const pillNeutral = { background: '#f3f4f6', color: '#5b5670', border: '1px solid #e5e7eb' } as const;
