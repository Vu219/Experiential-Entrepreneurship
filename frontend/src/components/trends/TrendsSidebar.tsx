import { memo } from 'react';
import { Globe, Hash, Newspaper, TrendingUp, CalendarClock, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import {
  SESSION_STATUS_COLORS,
  type ContentIdea,
  type ResearchSession,
  type TrendItem,
  type TrendsTab,
} from '../../trendsData';
import { type TrendSchedule } from '../../trendsSchedule';
import { Pill } from './filters';
import { C } from '../../styles/colors';

const SOURCE_ICONS = [Globe, Hash, Newspaper, TrendingUp];

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;
const labelStyle = { fontSize: 12.5, color: C.textMuted, fontWeight: 600 } as const;
const valueStyle = { fontSize: 13, fontWeight: 700, color: C.ink750, textAlign: 'right' } as const;

/**
 * Sidebar phải của trang Xu hướng. Thứ tự ưu tiên: "Lịch research tự động" (toggle
 * quan trọng, đặt trên đầu để không bị cắt khi cột phải dài) → "Trạng thái research"
 * (dựa trên PHIÊN GẦN NHẤT thật/mock — không hardcode) → khối giữa đổi theo sub-tab:
 * hot → lịch sử rút gọn · ideas → thống kê ý tưởng · history → thống kê phiên.
 * memo: mọi props đều được page memo hóa/ổn định — gõ tìm kiếm không dội vào sidebar.
 */
export default memo(function TrendsSidebar({
  tab,
  sessions,
  ideas,
  trends,
  savedIds,
  schedule,
  onViewHistory,
  onViewSession,
  onEditSchedule,
}: {
  tab: TrendsTab;
  sessions: ResearchSession[];
  ideas: ContentIdea[];
  trends: TrendItem[];
  savedIds: Set<string>;
  /** Cấu hình lịch research tự động (localStorage); null = chưa thiết lập (backend mặc định 02:00). */
  schedule: TrendSchedule | null;
  onViewHistory: () => void;
  /** Mở modal chi tiết một phiên research. */
  onViewSession: (session: ResearchSession) => void;
  onEditSchedule: () => void;
}) {
  const { t } = useApp();
  const latest = sessions[0] ?? null;
  const latestSt = latest ? SESSION_STATUS_COLORS[latest.status] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Lịch research tự động — toggle quan trọng, đưa lên đầu để không bị che khi sidebar dài */}
      <AutoScheduleCard schedule={schedule} onEdit={onEditSchedule} />

      {/* 2. Trạng thái research — theo phiên gần nhất, cố định ở mọi sub-tab */}
      <Card style={{ padding: 20 }}>
        <div style={{ ...rowStyle, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong }}>{t.trSideStatus}</div>
          {latest && latestSt && (
            <Pill text={latest.status === 'done' ? t.trDone : t.trCancelled} color={latestSt.color} bg={latestSt.bg} />
          )}
        </div>
        {!latest ? (
          <div style={{ fontSize: 13, color: C.textMuted }}>{t.trNoSession}</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trSideLatest}</span>
                <span style={valueStyle}>{latest.date} · {latest.time}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trIndustry}</span>
                <span style={valueStyle}>{latest.industry}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trPlatform}</span>
                <span style={{ display: 'flex', gap: 5 }}>
                  {latest.platformTags.map((tag) => (
                    <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={7} fontSize={10} />
                  ))}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trTrendsFound}</span>
                <span style={valueStyle}>{latest.trendsFound}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trIdeasCreated}</span>
                <span style={valueStyle}>{latest.ideasCreated}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trSideDuration}</span>
                <span style={valueStyle}>{latest.duration}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>{t.trSideSources}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {SOURCE_ICONS.map((Ic, i) => (
                    <span key={i} style={{ width: 22, height: 22, borderRadius: 7, background: C.surfaceMuted, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon icon={Ic} size={12} stroke={C.primary} />
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewSession(latest)}
              className="btn-soft"
              style={{ width: '100%', marginTop: 16, border: `1px solid ${C.accentLine}`, background: C.primarySoft, color: C.primaryStrong, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
            >
              {t.trSideDetail}
            </button>
          </>
        )}
      </Card>

      {/* 3. Khối giữa — đổi theo sub-tab */}
      {tab === 'hot' && <HistoryBrief sessions={sessions} onViewHistory={onViewHistory} onViewSession={onViewSession} />}
      {tab === 'ideas' && <IdeaStats ideas={ideas} trends={trends} savedIds={savedIds} />}
      {tab === 'history' && <SessionStats sessions={sessions} />}
    </div>
  );
});

/** Lịch research tự động — hiển thị cấu hình đã lưu (localStorage) + nút mở modal cài đặt. */
function AutoScheduleCard({ schedule, onEdit }: { schedule: TrendSchedule | null; onEdit: () => void }) {
  const { t } = useApp();
  const dayLabels = t.trDayShorts.split(',');
  const on = schedule ? schedule.enabled : true; // chưa cấu hình → job backend 02:00 mặc định đang chạy
  const pill = on
    ? { text: t.trScheduleOn, ...SESSION_STATUS_COLORS.done }
    : { text: t.trScheduleOffPill, ...SESSION_STATUS_COLORS.cancelled };

  const desc = schedule
    ? `${schedule.frequency === 'daily' ? t.trFreqDaily : `${t.trFreqWeekly} (${schedule.days.map((d) => dayLabels[d]).join(', ')})`} · ${schedule.time} · ${schedule.brandName}`
    : t.trScheduleDesc;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: `linear-gradient(135deg,${C.purpleSoft},${C.legacyBge9f0ff})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={CalendarClock} size={18} stroke={C.violetLight} />
        </div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: C.textStrong }}>{t.trSideSchedule}</div>
        <Pill text={pill.text} color={pill.color} bg={pill.bg} />
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55, marginBottom: schedule ? 6 : 14 }}>{desc}</div>
      {schedule && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {schedule.platforms.map((tag) => (
            <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={20} radius={6} fontSize={9.5} />
          ))}
          <span style={{ fontSize: 11.5, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schedule.strategyName}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="btn-outline"
        style={{ width: '100%', border: `1px solid ${C.border}`, background: C.surface, color: C.ink650, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
      >
        {t.trScheduleBtn}
      </button>
    </Card>
  );
}

/** Tab "Trend nổi bật": lịch sử research rút gọn (3 mục ở laptop, 5 mục ở PC) + link Xem tất cả. */
function HistoryBrief({
  sessions,
  onViewHistory,
  onViewSession,
}: {
  sessions: ResearchSession[];
  onViewHistory: () => void;
  onViewSession: (session: ResearchSession) => void;
}) {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const briefCount = width >= 1280 ? 5 : 3;
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ ...rowStyle, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong }}>{t.trSideHistory}</div>
        <button
          type="button"
          onClick={onViewHistory}
          className="link-underline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '2px 0', fontSize: 12.5, fontWeight: 600, color: C.primary, cursor: 'pointer' }}
        >
          {t.viewAll}
          <Icon icon={ChevronRight} size={13} stroke={C.primary} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.slice(0, briefCount).map((s, i) => {
          const st = SESSION_STATUS_COLORS[s.status];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onViewSession(s)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '10px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink750 }}>{s.date}</span>
                <Pill text={s.status === 'done' ? t.trDone : t.trCancelled} color={st.color} bg={st.bg} style={{ fontSize: 10.5, padding: '3px 8px' }} />
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
                {s.industry} · {s.platforms} {t.trPlatformUnit} · {s.trendsFound} {t.trTrendUnit} · {s.ideasCreated} {t.trIdeaUnit}
              </div>
            </button>
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
      <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong, marginBottom: 12 }}>{t.trSideIdeaStats}</div>
      <div style={{ ...rowStyle, marginBottom: 14 }}>
        <span style={labelStyle}>{t.trSavedTotal}</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: C.textStrong }}>{savedCount}</span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{t.trByFormat}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {formats.map(([fmt, count]) => (
          <div key={fmt}>
            <div style={{ ...rowStyle, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{fmt}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textStrong }}>{count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: C.surfaceMuted, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${Math.round((count / maxFormat) * 100)}%`, background: 'var(--brand)' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{t.trTopTrends}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {topTrends.map((tr, i) => (
          <div key={tr.id} style={{ ...rowStyle, padding: '8px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span aria-hidden style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, background: tr.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{tr.emoji}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.primary, whiteSpace: 'nowrap' }}>{tr.ideaCount} {t.trIdeaUnit}</span>
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
      <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong, marginBottom: 12 }}>{t.trSideSessionStats}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t.trTotalSessions}</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: C.textStrong }}>{sessions.length}</span>
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
          <div style={{ height: 7, borderRadius: 99, background: C.surfaceMuted, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${rate}%`, background: 'var(--brand)' }} />
          </div>
        </div>
      </div>
    </Card>
  );
}
