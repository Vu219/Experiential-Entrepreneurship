import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, PlatformTag } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { listAnalyzedPosts, type AnalyzedPost, type AnalyticsSnapshot } from '../../api/analytics.ts';

// UI-08 — Phân tích hiệu quả (FR-60/FR-61/FR-62): danh sách bài đã đăng kèm số liệu
// mới nhất; mở rộng từng bài để so sánh các mốc 24h / 48h / 7 ngày.

const PAGE_SIZE = 10;

const fmtNum = (n: number | null) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

/** Snapshot mốc muộn nhất của bài — dùng cho dòng tổng quan + tổng các thẻ. */
const latestSnapshot = (p: AnalyzedPost): AnalyticsSnapshot | null =>
  p.analytics.length === 0 ? null : p.analytics[p.analytics.length - 1];

export default function Analytics() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();

  const [data, setData] = useState<{ posts: AnalyzedPost[]; page: number; totalPages: number; totalElements: number }>({ posts: [], page: 0, totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(false);
    try {
      const result = await listAnalyzedPosts({ page, size: PAGE_SIZE });
      setData({ posts: result.content, page: result.page, totalPages: result.totalPages, totalElements: result.totalElements });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  // Tổng theo mốc mới nhất của từng bài trên trang hiện tại.
  const totals = useMemo(() => {
    const sum = { views: 0, likes: 0, comments: 0, shares: 0 };
    for (const p of data.posts) {
      const s = latestSnapshot(p);
      if (!s) continue;
      sum.views += s.views ?? 0;
      sum.likes += s.likes ?? 0;
      sum.comments += s.comments ?? 0;
      sum.shares += s.shares ?? 0;
    }
    return sum;
  }, [data.posts]);

  const statCards = [
    { icon: Eye, label: t.anaViews, value: totals.views, color: '#0e7490', bg: '#e0f7fb' },
    { icon: Heart, label: t.anaLikes, value: totals.likes, color: '#e23d6e', bg: '#fdecf1' },
    { icon: MessageCircle, label: t.anaComments, value: totals.comments, color: '#d97706', bg: '#fdf0dc' },
    { icon: Share2, label: t.anaShares, value: totals.shares, color: '#7c3aed', bg: '#f1e9ff' },
  ];

  return (
    <PageContainer>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18 }}>
        {statCards.map((s, i) => (
          <Card key={i} style={{ padding: 20, borderRadius: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={19} color={s.color} />
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 27, color: '#211c38', margin: '14px 0 2px' }}>{fmtNum(s.value)}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaListTitle}</div>
          <span style={{ fontSize: 12, color: '#a59fbb' }}>{t.anaListSub}</span>
        </div>

        {loading && <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 13, color: '#a39bbf' }}>…</div>}
        {error && (
          <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>
            {t.anaErr}{' '}
            <button onClick={() => load(data.page)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t.ntfRetry}</button>
          </div>
        )}
        {!loading && !error && data.posts.length === 0 && (
          <div style={{ padding: '34px 12px', textAlign: 'center' }}>
            <BarChart3 size={34} color="#c9c2df" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, color: '#8a85a0', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>{t.anaEmpty}</div>
          </div>
        )}

        {!loading && !error && data.posts.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {[t.colPost, t.colPlatform, t.anaViews, t.anaLikes, t.anaComments, t.anaShares, t.colDate, ''].map((h, i) => (
                    <th key={i} style={{ fontSize: 12, fontWeight: 600, color: '#a59fbb', padding: '12px 8px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.posts.map((p) => {
                  const s = latestSnapshot(p);
                  const tag = PLATFORM_TO_TAG[p.platformName] ?? p.platformName.slice(0, 2);
                  const expanded = expandedId === p.id;
                  return (
                    <PostRows
                      key={p.id}
                      post={p}
                      snapshot={s}
                      tag={tag}
                      expanded={expanded}
                      onToggle={() => setExpandedId(expanded ? null : p.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && data.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
            <button disabled={data.page === 0} onClick={() => load(data.page - 1)} style={pageBtn(data.page === 0)} aria-label="prev">
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 12.5, color: '#6b6680', fontWeight: 600 }}>{data.page + 1} / {data.totalPages}</span>
            <button disabled={data.page >= data.totalPages - 1} onClick={() => load(data.page + 1)} style={pageBtn(data.page >= data.totalPages - 1)} aria-label="next">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

function PostRows({ post, snapshot, tag, expanded, onToggle }: {
  post: AnalyzedPost;
  snapshot: AnalyticsSnapshot | null;
  tag: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useApp();
  return (
    <>
      <tr onClick={onToggle} style={{ borderTop: '1px solid #f1eef8', cursor: 'pointer', background: expanded ? '#faf9fe' : undefined }}>
        <td style={{ padding: '14px 8px', fontSize: 13.5, fontWeight: 600, color: '#2b2543', maxWidth: 320 }}>
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
            {post.formattedCaption || t.schNoCaption}
          </span>
          {post.accountName && <span style={{ display: 'block', fontSize: 11, color: '#a59fbb', marginTop: 3 }}>{post.accountName}</span>}
        </td>
        <td style={{ padding: '14px 8px' }}>
          <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={24} radius={7} fontSize={11} />
        </td>
        <td style={metricCell}>{fmtNum(snapshot?.views ?? null)}</td>
        <td style={metricCell}>{fmtNum(snapshot?.likes ?? null)}</td>
        <td style={metricCell}>{fmtNum(snapshot?.comments ?? null)}</td>
        <td style={metricCell}>{fmtNum(snapshot?.shares ?? null)}</td>
        <td style={{ padding: '14px 8px', fontSize: 12.5, color: '#8a85a0', whiteSpace: 'nowrap' }}>{fmtDate(post.publishedAt)}</td>
        <td style={{ padding: '14px 8px' }}>
          <ChevronDown size={15} color="#a39bbf" style={{ transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: '#faf9fe' }}>
          <td colSpan={8} style={{ padding: '4px 8px 16px' }}>
            <MilestoneComparison post={post} />
          </td>
        </tr>
      )}
    </>
  );
}

// FR-62: bảng so sánh các mốc 24h / 48h / 7 ngày, kèm chênh lệch so với mốc trước.
function MilestoneComparison({ post }: { post: AnalyzedPost }) {
  const { t } = useApp();
  const milestones = [24, 48, 168];
  const label = (h: number) => (h === 168 ? t.ana7d : `${h}${t.anaHours}`);
  const byMilestone = new Map(post.analytics.map((s) => [s.milestoneHours, s]));

  const metrics: { key: 'views' | 'likes' | 'comments' | 'shares'; label: string }[] = [
    { key: 'views', label: t.anaViews },
    { key: 'likes', label: t.anaLikes },
    { key: 'comments', label: t.anaComments },
    { key: 'shares', label: t.anaShares },
  ];

  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', padding: '10px 14px', borderBottom: '1px solid #f1eef8' }}>{t.anaCompare}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
          <thead>
            <tr>
              <th style={cmpHead}>{t.anaMilestone}</th>
              {metrics.map((m) => <th key={m.key} style={cmpHead}>{m.label}</th>)}
              <th style={cmpHead}>{t.anaCollected}</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((h, idx) => {
              const s = byMilestone.get(h);
              const prev = idx > 0 ? byMilestone.get(milestones[idx - 1]) : undefined;
              return (
                <tr key={h} style={{ borderTop: '1px solid #f5f2fb' }}>
                  <td style={{ ...cmpCell, fontWeight: 700, color: '#3f3a55' }}>{label(h)}</td>
                  {metrics.map((m) => (
                    <td key={m.key} style={cmpCell}>
                      {s ? (
                        <>
                          {fmtNum(s[m.key])}
                          <Delta current={s[m.key]} previous={prev?.[m.key] ?? null} />
                        </>
                      ) : (
                        <span style={{ color: '#c9c2df' }}>{t.anaPending}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ ...cmpCell, color: '#a59fbb', fontSize: 11.5 }}>{s ? fmtDate(s.collectedAt) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Delta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: up ? '#16a34a' : '#dc2626' }}>
      {up ? '+' : ''}{fmtNum(diff)}
    </span>
  );
}

const metricCell = { padding: '14px 8px', fontSize: 13.5, fontWeight: 700, color: '#2b2543' } as const;
const cmpHead = { textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#a59fbb', padding: '9px 14px' } as const;
const cmpCell = { padding: '10px 14px', fontSize: 13, color: '#2b2543' } as const;

const pageBtn = (disabled: boolean) => ({
  width: 30, height: 30, borderRadius: 8, border: '1px solid #ece8f6', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: disabled ? '#d5cfe8' : '#6b6680',
  cursor: disabled ? 'default' : 'pointer',
}) as const;
