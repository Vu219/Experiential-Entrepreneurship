import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card } from '../../components/ui.tsx';
import { weekdays } from '../../data.ts';
import { PLATFORM_BG } from '../../theme.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { cancelSchedule, listSchedules, type PostSchedule, type ScheduleStatus } from '../../api/schedules.ts';
import { useToast } from '../../components/toast/ToastProvider';
import ScheduleItem from '../../components/calendar/ScheduleItem.tsx';
import { CreateScheduleModal, RescheduleModal } from '../../components/calendar/ScheduleModals.tsx';
import { dateKey } from '../../components/calendar/dateUtils.ts';
import { FILTERS, STATUS_TONE } from '../../components/calendar/statusMeta.ts';

// UI-07 — Lịch đăng bài (FR-47..FR-51 + FR-58): lịch tháng (dot theo nền tảng) + hàng đợi
// với hành động Dời giờ / Hủy / Kích hoạt lại; modal Lên lịch mới có gợi ý khung giờ vàng (FR-48).

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const [schedules, setSchedules] = useState<PostSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScheduleStatus | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<PostSchedule | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSchedules(await listSchedules());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Hai lần bấm mới hủy thật; tự reset sau 4s để tránh hủy nhầm.
  useEffect(() => {
    if (!confirmCancelId) return;
    const timer = setTimeout(() => setConfirmCancelId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmCancelId]);

  const shown = useMemo(() => {
    let rows = schedules;
    if (filter !== 'ALL') rows = rows.filter((s) => s.status === filter);
    if (selectedDay) rows = rows.filter((s) => s.scheduledTime.slice(0, 10) === selectedDay);
    return rows;
  }, [schedules, filter, selectedDay]);

  const viewDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const cells = useMemo(() => buildMonth(viewDate, schedules), [viewDate, schedules]);

  const monthLabel = lang === 'en'
    ? `${MONTHS_EN[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    : `Tháng ${viewDate.getMonth() + 1}, ${viewDate.getFullYear()}`;

  const onCancel = async (s: PostSchedule) => {
    if (confirmCancelId !== s.id) {
      setConfirmCancelId(s.id);
      return;
    }
    setConfirmCancelId(null);
    setBusyId(s.id);
    try {
      await cancelSchedule(s.id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{monthLabel}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={navBtn} onClick={() => setMonthOffset((v) => v - 1)} aria-label="prev">‹</button>
              <button style={navBtn} onClick={() => setMonthOffset((v) => v + 1)} aria-label="next">›</button>
            </div>
          </div>
          <button onClick={() => setCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
            <CalendarClock size={15} />
            {t.schNew}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
          {weekdays(lang).map((w, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#a59fbb' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {cells.map((d, i) => {
            const selected = selectedDay === d.key;
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(selected ? null : d.key)}
                style={{
                  minHeight: isMobile ? 48 : 62,
                  borderRadius: 11,
                  padding: isMobile ? '5px 6px' : '7px 8px',
                  border: `1px solid ${selected ? '#8b5cf6' : d.today ? '#c4b5fd' : '#f1eef8'}`,
                  background: selected ? '#f1e9ff' : d.today ? '#f6f1ff' : '#fcfbfe',
                  opacity: d.muted ? 0.38 : 1,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, color: d.today || selected ? '#7c3aed' : '#3f3a55' }}>{d.day}</span>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                  {d.dots.map((bg, j) => (
                    <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: bg }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {selectedDay && (
          <button onClick={() => setSelectedDay(null)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#7c3aed', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            {t.schShowAll}
          </button>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.schQueue}</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', borderRadius: 999, padding: '4px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
            {t.calAuto}
          </span>
        </div>

        {/* Lối vào trung tâm hồi phục bài lỗi (FR-35..FR-39) — xử lý vi phạm chính sách / lỗi kỹ thuật */}
        <button
          onClick={() => go('failedPosts')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginBottom: 14, border: '1px solid #f2d9df', background: '#fdf5f7', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: '#c0356a', cursor: 'pointer' }}
        >
          <AlertTriangle size={14} />
          {t.fpNavFailed}
          <span style={{ marginLeft: 'auto' }}>›</span>
        </button>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const tone = f === 'ALL' ? null : TONE_COLORS[STATUS_TONE[f]];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  border: `1px solid ${active ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 999, padding: '5px 11px',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: active ? '#f1e9ff' : '#fff',
                  color: active ? '#7c3aed' : tone ? tone.color : '#6b6680',
                }}
              >
                {f === 'ALL' ? t.schAll : t[`schSt${f}` as keyof typeof t] as string}
              </button>
            );
          })}
        </div>

        {loading && <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 13, color: '#a39bbf' }}>…</div>}
        {error && (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>
            {t.schErr}{' '}
            <button onClick={load} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t.ntfRetry}</button>
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>
            {selectedDay ? t.schEmptyDay : t.schEmpty}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((s) => (
            <ScheduleItem
              key={s.id}
              schedule={s}
              busy={busyId === s.id}
              confirmingCancel={confirmCancelId === s.id}
              onReschedule={() => setRescheduling(s)}
              onCancel={() => onCancel(s)}
              onEditContent={() => go('create')}
            />
          ))}
        </div>
      </Card>

      {createOpen && (
        <CreateScheduleModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(); }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          schedule={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => { setRescheduling(null); load(); }}
        />
      )}
    </div>
  );
}

interface MonthCell { key: string; day: number; muted: boolean; today: boolean; dots: string[] }

// Lưới tháng thứ Hai-đầu-tuần: cell nào cũng là ngày thật (kể cả muted) để click lọc được.
function buildMonth(viewDate: Date, schedules: PostSchedule[]): MonthCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Chủ nhật (0) → cột 7
  const start = new Date(year, month, 1 - lead);
  const todayKey = dateKey(new Date());

  const dotsByDay = new Map<string, string[]>();
  for (const s of schedules) {
    if (s.status === 'CANCELLED') continue;
    const key = s.scheduledTime.slice(0, 10);
    const tag = PLATFORM_TO_TAG[s.platformName] ?? '';
    const list = dotsByDay.get(key) ?? [];
    if (list.length < 4) list.push(PLATFORM_BG[tag] ?? '#6b7280');
    dotsByDay.set(key, list);
  }

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(d);
    cells.push({
      key,
      day: d.getDate(),
      muted: d.getMonth() !== month,
      today: key === todayKey,
      dots: dotsByDay.get(key) ?? [],
    });
  }
  return cells;
}

const navBtn = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid #ece8f6', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a85a0', cursor: 'pointer',
} as const;
