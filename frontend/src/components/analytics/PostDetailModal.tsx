import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import PostDetailPanel from './PostDetailPanel';
import { formatDateTimeVN, formatGroupedNumber } from '../../utils/format';
import { getAnalyzedPost, type AnalyticsSnapshot, type AnalyticsTopPost } from '../../api/analytics';
import { C } from '../../styles/colors';

/** Các mốc so sánh của FR-62 (giờ sau khi đăng). */
const MILESTONES = [24, 48, 168] as const;

/**
 * Modal chi tiết bài viết khi người dùng click vào một dòng bài viết.
 * Hiển thị thông tin chi tiết bài viết (PostDetailPanel) kèm bảng So Sánh Với Mức Trung Bình (Comparison with Average)
 * và bảng số liệu theo mốc 24 giờ / 48 giờ / 7 ngày sau khi đăng (FR-62 — chỉ bài đăng qua AIMA, đọc
 * GET /analytics/posts/{postId}). Bài tự đăng ngoài AIMA không có mốc → chỉ ghi chú.
 *
 * Tính toán trung bình dựa trên tập dữ liệu `allPosts` có sẵn trong bộ nhớ mà không cần gọi API phụ.
 */
export default function PostDetailModal({
  post,
  allPosts = [],
  averageMetrics,
  demo = false,
  onClose,
}: {
  /** Dòng bài viết đang mở (số liệu mới nhất). */
  post: AnalyticsTopPost;
  /** Danh sách toàn bộ bài viết sẵn có trong bộ nhớ để tính giá trị trung bình. */
  allPosts?: AnalyticsTopPost[];
  /** Giá trị trung bình truyền trực tiếp (nếu có). */
  averageMetrics?: { views: number; likes: number; comments: number; shares: number } | null;
  /** Chế độ dữ liệu mẫu: không có mốc thật để tải. */
  demo?: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useApp();

  // Compute average metrics from dataset loaded in memory
  const avg = useMemo(() => {
    if (averageMetrics) return averageMetrics;
    if (!allPosts || allPosts.length === 0) return null;
    const count = allPosts.length;
    return {
      // Trung bình lượt xem chỉ trên bài CÓ số liệu — bài "—" không được kéo trung bình về 0.
      views: (() => {
        const rated = allPosts.filter((p) => p.views !== null);
        return rated.length ? Math.round(rated.reduce((sum, p) => sum + (p.views ?? 0), 0) / rated.length) : 0;
      })(),
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
      const cur = post[m.key] || 0;
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
  }, [avg, post, t]);

  return (
    <Modal
      title={t.anaPostDetail}
      subtitle={formatDateTimeVN(post.publishedAt)}
      onClose={onClose}
      maxWidth={900}
      animateScale
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Post Detail Panel */}
        <PostDetailPanel post={post} />

        {/* Section: số liệu theo mốc 24h / 48h / 7 ngày (FR-62) */}
        {!demo && <MilestoneSection post={post} />}

        {/* Section: Comparison with Average */}
        <div style={{ background: C.surfaceSubtle, borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.surfaceMuted}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textStrong, marginBottom: 12 }}>
            {t.anaVsAverage ?? 'So sánh với mức trung bình'}
          </div>

          {!comparisonRows ? (
            <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
              {t.anaVsAverageEmpty ?? 'Chưa có đủ dữ liệu để so sánh với mức trung bình.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ ...headCell, textAlign: 'left' }}>{t.colMetric ?? 'Chỉ số'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colCurrentPost ?? 'Bài viết này'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colAverage ?? 'Trung bình'}</th>
                    <th style={{ ...headCell, textAlign: 'right' }}>{t.colDifference ?? 'Chênh lệch'}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.key} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
                      <td style={{ ...cell, fontWeight: 600, color: C.ink750 }}>{row.label}</td>
                      <td style={numCell}>{formatGroupedNumber(row.current, lang)}</td>
                      <td style={{ ...numCell, color: C.textSecondary }}>{formatGroupedNumber(row.avg, lang)}</td>
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

/**
 * Bảng mốc 24 giờ / 48 giờ / 7 ngày của MỘT bài AIMA (số tích luỹ tại mốc, tính từ snapshot). Mốc chưa tới →
 * "Chưa tới mốc"; đã qua mà không có dòng → "Không thu được số liệu" (bài đăng trước khi có đồng bộ đầy đủ…).
 */
function MilestoneSection({ post }: { post: AnalyticsTopPost }) {
  const { t, lang } = useApp();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [rows, setRows] = useState<AnalyticsSnapshot[]>([]);
  const postId = post.postId;

  useEffect(() => {
    if (!postId) return;
    let alive = true;
    setState('loading');
    getAnalyzedPost(postId)
      .then((p) => { if (alive) { setRows(p.analytics); setState('ok'); } })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [postId]);

  const box = { background: C.surfaceSubtle, borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.surfaceMuted}` };
  const title = <div style={{ fontSize: 13, fontWeight: 700, color: C.textStrong, marginBottom: 12 }}>{t.anaMilestonesTitle}</div>;
  const note = (text: string) => <div style={{ fontSize: 13, color: C.textMuted, padding: '4px 0', lineHeight: 1.55 }}>{text}</div>;

  if (!postId) return <div style={box}>{title}{note(t.anaExternalDetailNote)}</div>;
  if (state !== 'ok') return <div style={box}>{title}{note(state === 'loading' ? t.anaMilestonesLoading : t.anaMilestonesError)}</div>;

  const label: Record<number, string> = { 24: t.anaMilestone24, 48: t.anaMilestone48, 168: t.anaMilestone168 };
  const published = new Date(post.publishedAt).getTime();
  const num = (v: number | null) => (v === null
    ? <span title={t.anaViewsMissing} style={{ cursor: 'help' }}>—</span>
    : formatGroupedNumber(v, lang));

  return (
    <div style={box}>
      {title}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ ...headCell, textAlign: 'left' }}>{t.anaMilestoneCol}</th>
              <th style={{ ...headCell, textAlign: 'right' }}>{t.anaViews}</th>
              <th style={{ ...headCell, textAlign: 'right' }}>{t.anaLikes}</th>
              <th style={{ ...headCell, textAlign: 'right' }}>{t.anaComments}</th>
              <th style={{ ...headCell, textAlign: 'right' }}>{t.anaShares}</th>
            </tr>
          </thead>
          <tbody>
            {MILESTONES.map((h) => {
              const row = rows.find((r) => r.milestoneHours === h);
              // publishedAt là giờ VN không kèm múi giờ → so sánh tương đối đủ dùng để biết mốc đã qua chưa.
              const reached = Date.now() >= published + h * 3_600_000;
              return (
                <tr key={h} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
                  <td style={{ ...cell, fontWeight: 600, color: C.ink750 }}>{label[h]}</td>
                  {row ? (
                    <>
                      <td style={numCell}>{num(row.views)}</td>
                      <td style={numCell}>{num(row.likes)}</td>
                      <td style={numCell}>{num(row.comments)}</td>
                      <td style={numCell}>{num(row.shares)}</td>
                    </>
                  ) : (
                    <td colSpan={4} style={{ ...cell, textAlign: 'right', color: C.textMuted }}>
                      {reached ? t.anaMilestoneMissing : t.anaMilestoneNotYet}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const headCell = { fontSize: 12, fontWeight: 600, color: C.textMuted, padding: '10px 8px', whiteSpace: 'nowrap' } as const;
const cell = { padding: '12px 8px', fontSize: 13, color: C.ink550, whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;
const numCell = { padding: '12px 8px', fontSize: 13.5, fontWeight: 700, color: C.ink900, textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;

const pillUp = { background: C.legacyBgecfdf5, color: C.legacyText047857, border: `1px solid ${C.legacyBordera7f3d0}` } as const;
const pillDown = { background: C.legacyBgfef2f2, color: C.legacyTextb91c1c, border: `1px solid ${C.legacyBorderfecaca}` } as const;
const pillNeutral = { background: C.graySoft, color: C.ink550, border: `1px solid ${C.legacyBordere5e7eb}` } as const;
