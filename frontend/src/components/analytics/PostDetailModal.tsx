import { useEffect, useMemo, useState } from 'react';
import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import Modal from '../Modal';
import PostDetailPanel, { sectionHeading } from './PostDetailPanel';
import MetricValue from './MetricValue';
import { METRIC_COLOR, type MetricKey } from './analyticsTokens';
import { formatGroupedNumber } from '../../utils/format';
import { getAnalyzedPost, type AnalyticsSnapshot, type AnalyticsTopPost } from '../../api/analytics';
import { C, alpha } from '../../styles/colors';

/** Các mốc so sánh của FR-62 (giờ sau khi đăng). */
const MILESTONES = [24, 48, 168] as const;

const METRIC_ICON: Record<MetricKey, typeof Eye> = { views: Eye, likes: Heart, comments: MessageCircle, shares: Share2 };

/**
 * Modal chi tiết bài viết khi người dùng click vào một dòng bài viết — bố cục gọn trong một khung hình:
 * màn rộng chia hai cột: trái = nội dung bài (PostDetailPanel, caption cuộn bên trong), phải = 4 thẻ chỉ số
 * (mỗi thẻ kèm mức trung bình + chênh lệch — thay cho bảng so sánh riêng) và bảng mốc 24 giờ / 48 giờ / 7 ngày
 * sau khi đăng (FR-62 — chỉ bài đăng qua AIMA, đọc GET /analytics/posts/{postId}; bài ngoài AIMA chỉ ghi chú).
 * Màn hẹp: một cột.
 *
 * Trung bình tính từ `allPosts` đã có trong bộ nhớ, không gọi API phụ.
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
  const { width } = useBreakpoint();
  const twoCol = width >= 900;

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

  // Mỗi chỉ số: giá trị bài này + trung bình + chênh lệch (null khi chưa đủ dữ liệu để so sánh).
  const metrics = useMemo(() => {
    const items: { key: MetricKey; label: string }[] = [
      { key: 'views', label: t.anaViews },
      { key: 'likes', label: t.anaLikes },
      { key: 'comments', label: t.anaComments },
      { key: 'shares', label: t.anaShares },
    ];
    return items.map((m) => {
      if (!avg || post[m.key] === null) return { ...m, avg: null, diffLabel: '', tone: 'neutral' as const };
      const cur = post[m.key] || 0;
      const mean = avg[m.key] || 0;

      let tone: 'up' | 'down' | 'neutral' = 'neutral';
      let diffLabel = '0%';

      if (mean === 0) {
        if (cur > 0) {
          tone = 'up';
          diffLabel = '+100% ↑';
        }
      } else {
        const pct = Math.round(((cur - mean) / mean) * 100);
        if (pct > 0) {
          tone = 'up';
          diffLabel = `+${pct}% ↑`;
        } else if (pct < 0) {
          tone = 'down';
          diffLabel = `${pct}% ↓`;
        }
      }
      return { ...m, avg: mean, diffLabel, tone };
    });
  }, [avg, post, t]);

  return (
    <Modal title={t.anaPostDetail} onClose={onClose} maxWidth={1040} animateScale>
      <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 0.95fr) minmax(0, 1.05fr)' : 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <PostDetailPanel post={post} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Thống kê + so sánh với mức trung bình */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={sectionHeading}>{t.pdpStatistics}</div>
              {avg && <div style={{ fontSize: 12, color: C.textMuted }}>{t.anaVsAverage}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {metrics.map((m) => {
                const Icon = METRIC_ICON[m.key];
                const color = METRIC_COLOR[m.key];
                return (
                  <div key={m.key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: alpha(color, 20 / 255), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon size={14} color={color} />
                      </div>
                      <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.ink900, margin: '8px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
                      <MetricValue value={post[m.key]} post={post} />
                    </div>
                    {m.avg !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{t.colAverage}: {formatGroupedNumber(m.avg, lang)}</span>
                        <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, ...(m.tone === 'up' ? pillUp : m.tone === 'down' ? pillDown : pillNeutral) }}>
                          {m.diffLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!avg && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 8 }}>{t.anaVsAverageEmpty}</div>}
          </div>

          {/* Số liệu theo mốc 24h / 48h / 7 ngày (FR-62) */}
          {!demo && <MilestoneSection post={post} />}
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

  const box = { background: C.surfaceSubtle, borderRadius: 14, padding: '12px 14px', border: `1px solid ${C.surfaceMuted}` };
  const title = <div style={{ ...sectionHeading, marginBottom: 6 }}>{t.anaMilestonesTitle}</div>;
  const note = (text: string) => <div style={{ fontSize: 12.5, color: C.textMuted, padding: '2px 0', lineHeight: 1.55 }}>{text}</div>;

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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
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

const headCell = { fontSize: 12, fontWeight: 600, color: C.textMuted, padding: '8px 8px', whiteSpace: 'nowrap' } as const;
const cell = { padding: '9px 8px', fontSize: 13, color: C.ink550, whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;
const numCell = { padding: '9px 8px', fontSize: 13.5, fontWeight: 700, color: C.ink900, textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;

const pillUp = { background: C.legacyBgecfdf5, color: C.legacyText047857, border: `1px solid ${C.legacyBordera7f3d0}` } as const;
const pillDown = { background: C.legacyBgfef2f2, color: C.legacyTextb91c1c, border: `1px solid ${C.legacyBorderfecaca}` } as const;
const pillNeutral = { background: C.graySoft, color: C.ink550, border: `1px solid ${C.legacyBordere5e7eb}` } as const;
