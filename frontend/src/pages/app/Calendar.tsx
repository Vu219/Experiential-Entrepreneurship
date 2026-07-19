import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, CalendarClock, RefreshCw, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, Icon } from '../../components/ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { cancelSchedule, listSchedules, type PostSchedule, type ScheduleStatus } from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';
import { useToast } from '../../components/toast/ToastProvider';
import ScheduleItem from '../../components/calendar/ScheduleItem.tsx';
import { CreateScheduleModal, RescheduleModal } from '../../components/calendar/ScheduleModals.tsx';
import { MONTHS_EN, absDayLabel } from '../../components/calendar/dateUtils.ts';
import MonthGrid, { buildMonth } from '../../components/calendar/MonthGrid.tsx';
import AgendaView from '../../components/calendar/AgendaView.tsx';
import UpcomingPanel, { AutoPill, FailedBanner, StatusChips } from '../../components/calendar/UpcomingPanel.tsx';
import StatCards from '../../components/calendar/StatCards.tsx';
import CalendarSkeleton from '../../components/calendar/CalendarSkeleton.tsx';
import DaySheet from '../../components/calendar/DaySheet.tsx';

// UI-07 — Lịch đăng bài (FR-47..FR-51 + FR-58), redesign 2026-07:
// hàng KPI (đếm client-side, thẻ Thất bại → trang Bài lỗi) + cột trái view Tháng (chip giờ +
// màu nền tảng, "+N") / Agenda (nhóm theo ngày) với chip lọc nền tảng + cột phải hàng đợi
// (chip trạng thái, banner lỗi có điều kiện, pill tự động đăng). Mobile: Agenda mặc định,
// lưới tháng dot + bottom sheet ngày, bỏ panel phải. Hành động giữ nguyên state machine:
// Dời giờ / Hủy 2 bước / Kích hoạt lại (ON_HOLD) / Sửa nội dung (FAILED); khung giờ vàng FR-48.

type LoadStatus = 'loading' | 'error' | 'ready';
type ViewMode = 'month' | 'agenda';

const PLATFORM_CHIPS: { key: Platform; name: string; bg: string }[] = [
  { key: 'FACEBOOK', name: 'Facebook', bg: PLATFORM_BG.FB },
  { key: 'INSTAGRAM', name: 'Instagram', bg: PLATFORM_BG.IG },
  { key: 'THREADS', name: 'Threads', bg: PLATFORM_BG.TH },
];

export default function Calendar() {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const { width, isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [schedules, setSchedules] = useState<PostSchedule[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<ViewMode>(isMobile ? 'agenda' : 'month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'ALL'>('ALL');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'ALL'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<PostSchedule | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        const rows = await listSchedules();
        if (!alive) return;
        setSchedules(rows);
        setStatus('ready');
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // Nạp lại sau hành động (hủy/dời/tạo) mà không nháy skeleton; lỗi thì giữ dữ liệu cũ.
  const refresh = useCallback(async () => {
    try {
      setSchedules(await listSchedules());
    } catch { /* giữ dữ liệu hiện có */ }
  }, []);

  // Hai lần bấm mới hủy thật; tự reset sau 4s để tránh hủy nhầm.
  useEffect(() => {
    if (!confirmCancelId) return;
    const timer = setTimeout(() => setConfirmCancelId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmCancelId]);

  const counts = useMemo(() => {
    const c = { scheduled: 0, onHold: 0, failed: 0, posted: 0 };
    for (const s of schedules) {
      if (s.status === 'SCHEDULED') c.scheduled++;
      else if (s.status === 'ON_HOLD') c.onHold++;
      else if (s.status === 'FAILED') c.failed++;
      else if (s.status === 'POSTED') c.posted++;
    }
    return c;
  }, [schedules]);

  // So kỳ cho thẻ "Đã đăng": bài POSTED trong 7 ngày gần nhất vs 7 ngày liền trước
  // (cửa sổ trượt tính từ hiện tại, mốc theo scheduledTime ≈ giờ đăng thật — dispatch mỗi 60s).
  const postedDelta = useMemo(() => {
    const now = Date.now();
    const week = 7 * 86400000;
    let current = 0;
    let previous = 0;
    for (const s of schedules) {
      if (s.status !== 'POSTED') continue;
      const ts = new Date(s.scheduledTime).getTime();
      if (ts >= now - week && ts < now) current++;
      else if (ts >= now - 2 * week && ts < now - week) previous++;
    }
    return { current, previous };
  }, [schedules]);

  const platformFiltered = useMemo(
    () => (platformFilter === 'ALL' ? schedules : schedules.filter((s) => s.platformName === platformFilter)),
    [schedules, platformFilter],
  );

  // Danh sách cho Agenda + panel: chip trạng thái + chip nền tảng + ngày đang chọn.
  const listShown = useMemo(() => {
    let rows = platformFiltered;
    if (statusFilter !== 'ALL') rows = rows.filter((s) => s.status === statusFilter);
    if (selectedDay) rows = rows.filter((s) => s.scheduledTime.slice(0, 10) === selectedDay);
    return rows;
  }, [platformFiltered, statusFilter, selectedDay]);

  const viewDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const cells = useMemo(() => buildMonth(viewDate, platformFiltered), [viewDate, platformFiltered]);

  const monthLabel = lang === 'en'
    ? `${MONTHS_EN[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    : `Tháng ${viewDate.getMonth() + 1}, ${viewDate.getFullYear()}`;

  // Sheet ngày (mobile) khớp với chip/dot trên lưới: loại CANCELLED như buildMonth.
  const sheetItems = useMemo(
    () => (selectedDay ? platformFiltered.filter((s) => s.status !== 'CANCELLED' && s.scheduledTime.slice(0, 10) === selectedDay) : []),
    [platformFiltered, selectedDay],
  );

  const onReschedule = useCallback((s: PostSchedule) => setRescheduling(s), []);
  const onEditContent = useCallback(() => go('create'), [go]);
  const onGoFailed = useCallback(() => go('failedPosts'), [go]);
  const onSelectDay = useCallback((key: string | null) => setSelectedDay(key), []);
  const onClearDay = useCallback(() => setSelectedDay(null), []);

  const onCancel = useCallback(async (s: PostSchedule) => {
    if (confirmCancelId !== s.id) {
      setConfirmCancelId(s.id);
      return;
    }
    setConfirmCancelId(null);
    setBusyId(s.id);
    try {
      await cancelSchedule(s.id);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [confirmCancelId, refresh, toast]);

  const outer: CSSProperties = {
    maxWidth: width >= 1440 ? 1320 : 1180, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20,
  };

  if (status === 'loading') {
    return (
      <div className="view-pop" style={outer} role="status" aria-busy="true">
        <span style={srOnly}>{t.calLoading}</span>
        <CalendarSkeleton stacked={stacked} isMobile={isMobile} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="view-pop" style={outer}>
        <StatePanel
          role="alert"
          tone="error"
          icon={AlertTriangle}
          title={t.schErr}
          message={t.calErrMsg}
          action={
            <button onClick={retry} className="btn-grad" style={primaryBtn(brandGradient)}>
              <Icon icon={RefreshCw} size={16} stroke="#fff" />
              {t.ntfRetry}
            </button>
          }
        />
      </div>
    );
  }

  const empty = schedules.length === 0;

  return (
    <div className="view-pop" style={outer}>
      <StatCards counts={counts} postedDelta={postedDelta} onFailedClick={onGoFailed} />

      {isMobile && !empty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {counts.failed > 0 && <FailedBanner count={counts.failed} onClick={onGoFailed} />}
          <AutoPill count={counts.scheduled} />
          {/* Chip trạng thái chỉ lọc danh sách — view Tháng (mobile) không dùng nên ẩn đi. */}
          {view === 'agenda' && <StatusChips value={statusFilter} onChange={setStatusFilter} />}
        </div>
      )}

      {empty ? (
        <StatePanel
          tone="empty"
          icon={CalendarClock}
          title={t.schEmpty}
          message={t.calEmptyMsg}
          action={
            <button onClick={() => setCreateOpen(true)} className="btn-grad" style={primaryBtn(brandGradient)}>
              <Icon icon={CalendarClock} size={16} stroke="#fff" />
              {t.schNew}
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : width >= 1440 ? '1.6fr 1fr' : '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              {view === 'month' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{monthLabel}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={navBtn} onClick={() => setMonthOffset((v) => v - 1)} aria-label={t.calPrevMonth}>‹</button>
                    <button style={navBtn} onClick={() => setMonthOffset((v) => v + 1)} aria-label={t.calNextMonth}>›</button>
                  </div>
                </div>
              ) : (
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{t.calViewAgenda}</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: '#f6f4fb', borderRadius: 10, padding: 3, gap: 2 }}>
                  {(['month', 'agenda'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      style={{
                        border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        background: view === v ? '#fff' : 'transparent',
                        color: view === v ? '#7c3aed' : '#6b6680',
                        boxShadow: view === v ? '0 2px 8px -3px rgba(80,60,140,.25)' : 'none',
                      }}
                    >
                      {v === 'month' ? t.calViewMonth : t.calViewAgenda}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
                  <CalendarClock size={15} />
                  {t.schNew}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => setPlatformFilter('ALL')} aria-pressed={platformFilter === 'ALL'} style={platformChip(platformFilter === 'ALL')}>
                {t.schAll}
              </button>
              {PLATFORM_CHIPS.map((p) => (
                <button key={p.key} onClick={() => setPlatformFilter(p.key)} aria-pressed={platformFilter === p.key} style={platformChip(platformFilter === p.key)}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.bg, flex: 'none' }} />
                  {p.name}
                </button>
              ))}
            </div>

            {view === 'month' ? (
              <>
                <MonthGrid cells={cells} selectedDay={selectedDay} onSelectDay={onSelectDay} compact={isMobile} />
                {selectedDay && !isMobile && (
                  <button onClick={onClearDay} style={{ marginTop: 12, background: 'none', border: 'none', color: '#7c3aed', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    {t.schShowAll}
                  </button>
                )}
              </>
            ) : (
              <AgendaView
                schedules={listShown}
                busyId={busyId}
                confirmCancelId={confirmCancelId}
                onReschedule={onReschedule}
                onCancel={onCancel}
                onEditContent={onEditContent}
                selectedDay={selectedDay}
                onClearDay={onClearDay}
              />
            )}
          </Card>

          {!isMobile && (
            <Card>
              <UpcomingPanel
                schedules={listShown}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                failedCount={counts.failed}
                onGoFailed={onGoFailed}
                autoCount={counts.scheduled}
                selectedDay={selectedDay}
                onClearDay={onClearDay}
                busyId={busyId}
                confirmCancelId={confirmCancelId}
                onReschedule={onReschedule}
                onCancel={onCancel}
                onEditContent={onEditContent}
              />
            </Card>
          )}
        </div>
      )}

      {isMobile && view === 'month' && selectedDay && (
        <DaySheet title={absDayLabel(selectedDay, lang)} onClose={onClearDay}>
          {sheetItems.length === 0 ? (
            <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>{t.schEmptyDay}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sheetItems.map((s) => (
                <ScheduleItem
                  key={s.id}
                  schedule={s}
                  busy={busyId === s.id}
                  confirmingCancel={confirmCancelId === s.id}
                  onReschedule={onReschedule}
                  onCancel={onCancel}
                  onEditContent={onEditContent}
                />
              ))}
            </div>
          )}
        </DaySheet>
      )}

      {createOpen && (
        <CreateScheduleModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); refresh(); }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          schedule={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => { setRescheduling(null); refresh(); }}
        />
      )}
    </div>
  );
}

/** Panel lỗi / trống căn giữa — cùng pattern StatePanel của Dashboard. */
function StatePanel({ tone, icon, title, message, action, role }: {
  tone: 'error' | 'empty';
  icon: LucideIcon;
  title: string;
  message: string;
  action: React.ReactNode;
  role?: 'alert';
}) {
  const accent = tone === 'error' ? '#e23d6e' : '#7c3aed';
  const tintBg = tone === 'error' ? '#fdeef2' : '#f4ecff';
  return (
    <Card style={{ padding: '48px 28px' }}>
      <div role={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: tintBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={26} stroke={accent} />
        </div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 19, color: '#211c38' }}>{title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: '#5b5670' }}>{message}</div>
        <div style={{ marginTop: 6 }}>{action}</div>
      </div>
    </Card>
  );
}

const primaryBtn = (brandGradient: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12,
  padding: '11px 20px', fontWeight: 700, fontSize: 14, color: '#fff',
  background: brandGradient, cursor: 'pointer',
});

const platformChip = (active: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  border: `1px solid ${active ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 999, padding: '5px 11px',
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  background: active ? '#f1e9ff' : '#fff',
  color: active ? '#7c3aed' : '#6b6680',
});

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

const navBtn = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid #ece8f6', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a85a0', cursor: 'pointer',
} as const;
