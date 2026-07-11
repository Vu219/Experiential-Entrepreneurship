import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, PencilLine, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, PlatformTag } from '../../components/ui.tsx';
import Modal from '../../components/Modal.tsx';
import { weekdays } from '../../data.ts';
import { PLATFORM_BG } from '../../theme.ts';
import { TONE_COLORS, type Tone } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG, listConnections, type PlatformConnection } from '../../api/connections.ts';
import { listContentItems, type ContentItemResponse, type ContentVersionResponse } from '../../api/contentGeneration.ts';
import {
  cancelSchedule, createSchedule, getGoldenHours, listSchedules, updateSchedule,
  type GoldenHours, type PostSchedule, type ScheduleStatus,
} from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';

// UI-07 — Lịch đăng bài (FR-47..FR-51 + FR-58): lịch tháng (dot theo nền tảng) + hàng đợi
// với hành động Dời giờ / Hủy / Kích hoạt lại; modal Lên lịch mới có gợi ý khung giờ vàng (FR-48).

const STATUS_TONE: Record<ScheduleStatus, Tone> = {
  SCHEDULED: 'purple', ON_HOLD: 'warning', POSTING: 'warning',
  POSTED: 'success', FAILED: 'danger', CANCELLED: 'neutral',
};

const FILTERS: (ScheduleStatus | 'ALL')[] = ['ALL', 'SCHEDULED', 'ON_HOLD', 'POSTED', 'FAILED', 'CANCELLED'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (iso: string) => iso.slice(11, 16);
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Giá trị datetime-local "YYYY-MM-DDTHH:mm" của thời điểm hiện tại (giờ máy user). */
const nowLocal = () => {
  const d = new Date();
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const { t, lang, go, brandGradient } = useApp();
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
      alert((e as Error).message);
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

function ScheduleItem({ schedule: s, busy, confirmingCancel, onReschedule, onCancel, onEditContent }: {
  schedule: PostSchedule;
  busy: boolean;
  confirmingCancel: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  onEditContent: () => void;
}) {
  const { t } = useApp();
  const tone = TONE_COLORS[STATUS_TONE[s.status]];
  const tag = PLATFORM_TO_TAG[s.platformName] ?? s.platformName.slice(0, 2);
  const caption = s.contentVersion?.formattedCaption ?? '';
  const canReschedule = s.status === 'SCHEDULED' || s.status === 'ON_HOLD';
  const canCancel = canReschedule || s.status === 'FAILED';

  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 13, background: '#fcfbfe', opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ textAlign: 'center', flex: 'none', width: 50 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#211c38' }}>{fmtTime(s.scheduledTime)}</div>
          <div style={{ fontSize: 10.5, color: '#a59fbb' }}>{fmtDate(s.scheduledTime)}</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: '#efeaf8' }} />
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={30} radius={8} fontSize={11} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2543', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {caption || t.schNoCaption}
          </div>
          <div style={{ fontSize: 11, color: '#a59fbb', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.platformAccountName}</div>
        </div>
        <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: tone.color, background: tone.bg }}>
          {t[`schSt${s.status}` as keyof typeof t] as string}
        </span>
      </div>

      {(s.status === 'ON_HOLD' || s.status === 'FAILED') && (
        <div style={{ fontSize: 11.5, color: s.status === 'FAILED' ? '#b91c1c' : '#b45309', background: s.status === 'FAILED' ? '#fdf1f1' : '#fdf6e7', borderRadius: 9, padding: '7px 10px', marginTop: 9, lineHeight: 1.45 }}>
          {s.status === 'ON_HOLD' ? t.schOnHoldHint : t.schFailedHint}
        </div>
      )}

      {(canReschedule || canCancel) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {canReschedule && (
            <ActionBtn icon={<Clock size={13} />} label={s.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule} onClick={onReschedule} disabled={busy} />
          )}
          {s.status === 'FAILED' && (
            <ActionBtn icon={<PencilLine size={13} />} label={t.schEditContent} onClick={onEditContent} disabled={busy} />
          )}
          {canCancel && (
            <ActionBtn
              icon={s.status === 'FAILED' ? <RotateCcw size={13} /> : <Trash2 size={13} />}
              label={confirmingCancel ? t.schConfirmCancel : s.status === 'FAILED' ? t.schResetFailed : t.schCancel}
              onClick={onCancel}
              disabled={busy}
              danger={!confirmingCancel}
              emphasized={confirmingCancel}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, disabled, danger = false, emphasized = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; emphasized?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${emphasized ? '#e23d6e' : '#ece8f6'}`,
        borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 700,
        background: emphasized ? '#e23d6e' : '#fff',
        color: emphasized ? '#fff' : danger ? '#e23d6e' : '#5b5670',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Bản FORMATTED có thể lên lịch, kèm bài gốc để hiển thị. */
interface SchedulableVersion {
  version: ContentVersionResponse;
  item: ContentItemResponse;
}

function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useApp();
  const [versions, setVersions] = useState<SchedulableVersion[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionId, setVersionId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [time, setTime] = useState('');
  const [golden, setGolden] = useState<GoldenHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [items, conns] = await Promise.all([
          listContentItems({ size: 50 }),
          listConnections(),
        ]);
        const formatted: SchedulableVersion[] = [];
        for (const item of items.content) {
          for (const v of item.versions) {
            if (v.status === 'FORMATTED') formatted.push({ version: v, item });
          }
        }
        setVersions(formatted);
        setConnections(conns.filter((c) => c.connectionStatus === 'ACTIVE'));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = versions.find((v) => v.version.id === versionId) ?? null;
  const accounts = useMemo(
    () => (selected ? connections.filter((c) => c.platform === selected.version.platformName) : []),
    [selected, connections],
  );

  // FR-48: gợi ý khung giờ vàng theo nền tảng của bản được chọn.
  useEffect(() => {
    setGolden(null);
    if (!selected) return;
    getGoldenHours(selected.version.platformName as Platform).then(setGolden).catch(() => undefined);
  }, [selected?.version.platformName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Khi đổi bản chọn, account cũ có thể sai nền tảng.
  useEffect(() => { setAccountId(''); }, [versionId]);

  const applyGoldenHour = (slot: string) => {
    const start = slot.split('-')[0]?.trim();
    if (!/^\d{2}:\d{2}$/.test(start ?? '')) return;
    const base = time ? time.slice(0, 10) : dateKey(new Date());
    let candidate = `${base}T${start}`;
    if (candidate <= nowLocal()) {
      const d = new Date(`${base}T00:00:00`);
      d.setDate(d.getDate() + 1);
      candidate = `${dateKey(d)}T${start}`;
    }
    setTime(candidate);
  };

  const submit = async () => {
    if (!versionId || !accountId || !time) return;
    if (time <= nowLocal()) {
      setError(t.schErrPast);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSchedule({ contentVersionId: versionId, platformAccountId: accountId, scheduledTime: `${time}:00` });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={t.schNew} subtitle={t.schNewSub} onClose={onClose} maxWidth={520}>
      {loading && <div style={{ padding: '20px 0', textAlign: 'center', color: '#a39bbf', fontSize: 13 }}>…</div>}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>{t.schVersion}</label>
            {versions.length === 0 ? (
              <div style={hint}>{t.schNoVersions}</div>
            ) : (
              <select value={versionId} onChange={(e) => setVersionId(e.target.value)} style={inp}>
                <option value="">—</option>
                {versions.map(({ version, item }) => (
                  <option key={version.id} value={version.id}>
                    [{PLATFORM_TO_TAG[version.platformName] ?? version.platformName}] {(version.formattedCaption ?? item.caption ?? '').slice(0, 60) || version.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selected && (
            <div>
              <label style={lbl}>{t.schAccount}</label>
              {accounts.length === 0 ? (
                <div style={hint}>{t.schNoAccounts}</div>
              ) : (
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inp}>
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName}{a.platformUsername ? ` (@${a.platformUsername})` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label style={lbl}>{t.schTime}</label>
            <input type="datetime-local" value={time} min={nowLocal()} onChange={(e) => setTime(e.target.value)} style={inp} />
            {golden && golden.suggestedHours.length > 0 && (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>
                  <Sparkles size={13} />
                  {t.schGolden} · {golden.dataDriven ? t.schGoldenData : t.schGoldenDefault}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {golden.suggestedHours.map((h) => (
                    <button key={h} onClick={() => applyGoldenHour(h)} style={{ border: '1px solid #e3d9fb', background: '#f8f5ff', color: '#6d28d9', borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdecf1', borderRadius: 9, padding: '8px 11px' }}>{error}</div>}

          <button
            onClick={submit}
            disabled={saving || !versionId || !accountId || !time}
            style={{
              border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff',
              background: 'var(--brand-gradient)', cursor: saving ? 'default' : 'pointer',
              opacity: saving || !versionId || !accountId || !time ? 0.55 : 1,
            }}
          >
            {saving ? t.schCreating : t.schCreate}
          </button>
        </div>
      )}
    </Modal>
  );
}

function RescheduleModal({ schedule, onClose, onSaved }: { schedule: PostSchedule; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [time, setTime] = useState(schedule.scheduledTime.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (time <= nowLocal()) {
      setError(t.schErrPast);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSchedule(schedule.id, `${time}:00`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={schedule.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule}
      subtitle={schedule.status === 'ON_HOLD' ? t.schReactivateSub : undefined}
      onClose={onClose}
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>{t.schTime}</label>
          <input type="datetime-local" value={time} min={nowLocal()} onChange={(e) => setTime(e.target.value)} style={inp} />
        </div>
        {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdecf1', borderRadius: 9, padding: '8px 11px' }}>{error}</div>}
        <button
          onClick={submit}
          disabled={saving}
          style={{ border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff', background: 'var(--brand-gradient)', cursor: 'pointer', opacity: saving ? 0.55 : 1 }}
        >
          {saving ? t.schCreating : t.schSave}
        </button>
      </div>
    </Modal>
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

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#4b4660', marginBottom: 6 } as const;
const inp = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none' } as const;
const hint = { fontSize: 12.5, color: '#8a85a0', background: '#f7f6fd', borderRadius: 9, padding: '9px 11px', lineHeight: 1.5 } as const;
