import { Globe, Hash, Newspaper, TrendingUp, CalendarClock, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import {
  SESSION_STATUS_COLORS,
  latestResearch,
  type ContentIdea,
  type ResearchSession,
  type TrendItem,
  type TrendsTab,
} from '../../trendsData';
import { Pill } from './filters';

const SOURCE_ICONS = [Globe, Hash, Newspaper, TrendingUp];

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;
const labelStyle = { fontSize: 12.5, color: '#8a85a0', fontWeight: 600 } as const;
const valueStyle = { fontSize: 13, fontWeight: 700, color: '#2b2543', textAlign: 'right' } as const;

/**
 * Sidebar phải của trang Xu hướng. Khối "Trạng thái research" (trên) và
 * "Lịch research tự động" (dưới) cố định; khối giữa đổi theo sub-tab:
 * hot → lịch sử rút gọn · ideas → thống kê ý tưởng · history → thống kê phiên.
 */
export default function TrendsSidebar({
  tab,
  sessions,
  ideas,
  trends,
  savedIds,
  onViewHistory,
}: {
  tab: TrendsTab;
  sessions: ResearchSession[];
  ideas: ContentIdea[];
  trends: TrendItem[];
  savedIds: Set<string>;
  onViewHistory: () => void;
}) {
  const { t, lang } = useApp();
  const latest = latestResearch(lang);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Trạng thái research — cố định ở mọi sub-tab */}
      <Card style={{ padding: 20 }}>
        <div style={{ ...rowStyle, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.trSideStatus}</div>
          <Pill text={t.trDone} color={SESSION_STATUS_COLORS.done.color} bg={SESSION_STATUS_COLORS.done.bg} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trSideLatest}</span>
            <span style={valueStyle}>{latest.dateLabel}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trIndustry}</span>
            <span style={valueStyle}>{latest.industry}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trPlatform}</span>
            <span style={{ display: 'flex', gap: 5 }}>
              {latest.platforms.map((tag) => (
                <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={7} fontSize={10} />
              ))}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trSideDuration}</span>
            <span style={valueStyle}>{latest.duration}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trSideSources}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {SOURCE_ICONS.map((Ic, i) => (
                <span key={i} style={{ width: 22, height: 22, borderRadius: 7, background: '#f4f2fb', border: '1px solid #ece8f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={Ic} size={12} stroke="#7c3aed" />
                </span>
              ))}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', background: '#f3edff', borderRadius: 7, padding: '3px 6px' }}>+{latest.extraSources}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn-soft"
          style={{ width: '100%', marginTop: 16, border: '1px solid #e7d9fb', background: '#f3edff', color: '#6d28d9', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
        >
          {t.trSideDetail}
        </button>
      </Card>

      {/* 2. Khối giữa — đổi theo sub-tab */}
      {tab === 'hot' && <HistoryBrief sessions={sessions} onViewHistory={onViewHistory} />}
      {tab === 'ideas' && <IdeaStats ideas={ideas} trends={trends} savedIds={savedIds} />}
      {tab === 'history' && <SessionStats sessions={sessions} />}

      {/* 3. Lịch research tự động — cố định ở mọi sub-tab */}
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#f1e9ff,#e9f0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={CalendarClock} size={18} stroke="#8b5cf6" />
          </div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.trSideSchedule}</div>
          <Pill text={t.trScheduleOn} color={SESSION_STATUS_COLORS.done.color} bg={SESSION_STATUS_COLORS.done.bg} />
        </div>
        <div style={{ fontSize: 12.5, color: '#6b6680', lineHeight: 1.55, marginBottom: 14 }}>{t.trScheduleDesc}</div>
        <button
          type="button"
          className="btn-outline"
          style={{ width: '100%', border: '1px solid #ece8f6', background: '#fff', color: '#4b4660', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
        >
          {t.trScheduleBtn}
        </button>
      </Card>
    </div>
  );
}

/** Tab "Trend nổi bật": lịch sử research rút gọn 4 item + link Xem tất cả. */
function HistoryBrief({ sessions, onViewHistory }: { sessions: ResearchSession[]; onViewHistory: () => void }) {
  const { t } = useApp();
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ ...rowStyle, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.trSideHistory}</div>
        <button
          type="button"
          onClick={onViewHistory}
          className="link-underline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '2px 0', fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}
        >
          {t.viewAll}
          <Icon icon={ChevronRight} size={13} stroke="#7c3aed" />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.slice(0, 4).map((s, i) => {
          const st = SESSION_STATUS_COLORS[s.status];
          return (
            <div key={s.id} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2b2543' }}>{s.date}</span>
                <Pill text={s.status === 'done' ? t.trDone : t.trCancelled} color={st.color} bg={st.bg} style={{ fontSize: 10.5, padding: '3px 8px' }} />
              </div>
              <div style={{ fontSize: 11.5, color: '#8a85a0', marginTop: 3 }}>
                {s.industry} · {s.platforms} {t.trPlatformUnit} · {s.trendsFound} {t.trTrendUnit} · {s.ideasCreated} {t.trIdeaUnit}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Tab "Ý tưởng content": tổng đã lưu, phân bổ theo định dạng, top trend sinh ý tưởng. */
function IdeaStats({ ideas, trends, savedIds }: { ideas: ContentIdea[]; trends: TrendItem[]; savedIds: Set<string> }) {
  const { t } = useApp();
  const savedCount = ideas.filter((i) => i.status === 'saved' || (i.status === 'new' && savedIds.has(i.id))).length;

  const byFormat = new Map<string, number>();
  ideas.forEach((i) => byFormat.set(i.format, (byFormat.get(i.format) ?? 0) + 1));
  const formats = [...byFormat.entries()].sort((a, b) => b[1] - a[1]);
  const maxFormat = formats[0]?.[1] ?? 1;

  const topTrends = [...trends].sort((a, b) => b.ideaCount - a.ideaCount).slice(0, 3);

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38', marginBottom: 12 }}>{t.trSideIdeaStats}</div>
      <div style={{ ...rowStyle, marginBottom: 14 }}>
        <span style={labelStyle}>{t.trSavedTotal}</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{savedCount}</span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8a85a0', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{t.trByFormat}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {formats.map(([fmt, count]) => (
          <div key={fmt}>
            <div style={{ ...rowStyle, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3a55' }}>{fmt}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38' }}>{count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${Math.round((count / maxFormat) * 100)}%`, background: 'var(--brand)' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8a85a0', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{t.trTopTrends}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {topTrends.map((tr, i) => (
          <div key={tr.id} style={{ ...rowStyle, padding: '8px 0', borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span aria-hidden style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: tr.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{tr.emoji}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3f3a55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>{tr.ideaCount} {t.trIdeaUnit}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Tab "Lịch sử research": thống kê tổng quan phiên (thay khối lịch sử rút gọn bị trùng). */
function SessionStats({ sessions }: { sessions: ResearchSession[] }) {
  const { t } = useApp();
  const done = sessions.filter((s) => s.status === 'done').length;
  const cancelled = sessions.length - done;
  const rate = sessions.length ? Math.round((done / sessions.length) * 100) : 0;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38', marginBottom: 12 }}>{t.trSideSessionStats}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t.trTotalSessions}</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{sessions.length}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: SESSION_STATUS_COLORS.done.color }} />
            {t.trDone}
          </span>
          <span style={valueStyle}>{done}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: SESSION_STATUS_COLORS.cancelled.color }} />
            {t.trCancelled}
          </span>
          <span style={valueStyle}>{cancelled}</span>
        </div>
        <div>
          <div style={{ ...rowStyle, marginBottom: 5 }}>
            <span style={labelStyle}>{t.trSuccessRate}</span>
            <span style={valueStyle}>{rate}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${rate}%`, background: 'var(--brand)' }} />
          </div>
        </div>
      </div>
    </Card>
  );
}
