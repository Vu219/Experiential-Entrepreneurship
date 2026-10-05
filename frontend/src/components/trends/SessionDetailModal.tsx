import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { FIT_COLORS, SESSION_STATUS_COLORS, type ResearchSession, type TrendItem } from '../../trendsData';
import { liveTrendItems } from '../../trendsLive';
import { getTrendResearchSession, type ResearchSessionDetail } from '../../api/trendResearch';
import { Pill } from './filters';
import { C } from '../../styles/colors';

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;
const labelStyle = { fontSize: 12.5, color: C.textMuted, fontWeight: 600 } as const;
const valueStyle = { fontSize: 13, fontWeight: 700, color: C.ink750, textAlign: 'right' } as const;

const MAX_TREND_ROWS = 6;

/**
 * Chi tiết một phiên research (FR-23): thông tin phiên + danh sách trend tìm được.
 * Phiên thật (live) → fetch GET /trend-research/sessions/{id}; phiên mock → hiện
 * danh sách trend demo do trang truyền vào kèm badge "Dữ liệu demo".
 */
export default function SessionDetailModal({
  session,
  live,
  demoTrends,
  onClose,
}: {
  session: ResearchSession;
  /** true = phiên từ backend thật (fetch chi tiết theo id). */
  live: boolean;
  /** Trend demo hiển thị cho phiên mock (trang đã xoay/cắt sẵn). */
  demoTrends: TrendItem[];
  onClose: () => void;
}) {
  const { t, lang } = useApp();
  const [detail, setDetail] = useState<ResearchSessionDetail | null>(null);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getTrendResearchSession(session.id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [live, session.id]);

  const done = session.status === 'done';
  const st = SESSION_STATUS_COLORS[session.status];
  const fitLabel = { high: t.trFitHigh, medium: t.trFitMed, low: t.trFitLow } as const;

  const trends: TrendItem[] = live ? (detail ? liveTrendItems(detail, lang) : []) : demoTrends;
  const shown = trends.slice(0, MAX_TREND_ROWS);
  const extra = trends.length - shown.length;

  return (
    <Modal title={t.trSessionDetailTitle} onClose={onClose} maxWidth={520} animateScale>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header phiên */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon icon={done ? CheckCircle2 : XCircle} size={26} stroke={st.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.textStrong }}>{session.date} · {session.time}</div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{session.industry}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <Pill text={done ? t.trDone : t.trCancelled} color={st.color} bg={st.bg} />
            {!live && <Pill text={t.trDemoData} color={C.textSecondary} bg={C.legacyBgf1eef9} style={{ fontSize: 10.5, padding: '3px 8px' }} />}
          </div>
        </div>

        {/* Thống kê phiên */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            [String(session.trendsFound), t.trTrendsFound],
            [String(session.ideasCreated), t.trIdeasCreated],
            [session.duration, t.trSideDuration],
          ].map(([value, label]) => (
            <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: C.textStrong }}>{value}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Meta bổ sung của phiên thật */}
        {live && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {detail.strategyName && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trStrategy}</span>
                <span style={valueStyle}>{detail.strategyName}</span>
              </div>
            )}
            {detail.articleCount != null && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trArticleCount}</span>
                <span style={valueStyle}>{detail.articleCount}</span>
              </div>
            )}
            {detail.summary && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>{t.trSummary}</div>
                <div style={{ fontSize: 13, color: C.ink650, lineHeight: 1.6, background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '10px 12px' }}>{detail.summary}</div>
              </div>
            )}
          </div>
        )}

        {/* Trend tìm được */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>{t.trTrendsFound}</div>
          {loading ? (
            <div style={{ padding: '14px 0', fontSize: 13, color: C.textMuted, textAlign: 'center' }}>{t.trLoading}</div>
          ) : error ? (
            <div role="alert" style={{ fontSize: 13, color: C.danger }}>{error}</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: '10px 0', fontSize: 13, color: C.ink350 }}>{t.trNoResult}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {shown.map((tr, i) => {
                const fc = FIT_COLORS[tr.fit];
                return (
                  <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
                    <span aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: tr.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{tr.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                      <div style={{ fontSize: 11.5, color: C.textMuted }}>{tr.ideaCount} {t.trIdeaUnit}</div>
                    </div>
                    <span style={{ display: 'flex', gap: 4 }}>
                      {tr.platforms.map((tag) => (
                        <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={20} radius={6} fontSize={9} />
                      ))}
                    </span>
                    <Pill text={fitLabel[tr.fit]} color={fc.color} bg={fc.bg} style={{ fontSize: 10.5, padding: '3px 8px' }} />
                  </div>
                );
              })}
              {extra > 0 && (
                <div style={{ fontSize: 12, color: C.textMuted, paddingTop: 8, borderTop: `1px solid ${C.surfaceMuted}` }}>+{extra} {t.trMoreTrends}</div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-outline"
          style={{ width: '100%', border: `1px solid ${C.border}`, background: C.surface, color: C.ink650, fontWeight: 700, fontSize: 13, borderRadius: 11, padding: '10px 12px', cursor: 'pointer' }}
        >
          {t.trClose}
        </button>
      </div>
    </Modal>
  );
}
