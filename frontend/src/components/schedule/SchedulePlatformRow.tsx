import { useState, type CSSProperties } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import DatePicker from '../DatePicker.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { getSuggestedSlots, type PostSchedule, type SuggestedSlot } from '../../api/schedules.ts';
import type { PlannerAccount, PlannerRow, RowError, RowMode } from './plannerLogic.ts';

// Một dòng của SchedulePlanner = một bản nền tảng. Dòng bị khóa hiển thị lý do (IG cần ảnh/video, chưa định dạng,
// đã có lịch, chưa kết nối) thay vì ẩn đi; dòng đủ điều kiện chọn chế độ Đăng ngay / Chọn giờ / Gợi ý / Bỏ qua.

const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };
const MODES: RowMode[] = ['NOW', 'SCHEDULE', 'SUGGEST', 'NONE'];

export interface SchedulePlatformRowProps {
  row: PlannerRow;
  accounts: PlannerAccount[];
  sharedEnabled: boolean;
  goldenHours: string[];
  conflicts: PostSchedule[];
  error: RowError;
  showError: boolean;
  todayISO: string;
  onChange: (patch: Partial<PlannerRow>) => void;
  onConnect: () => void;
}

export default function SchedulePlatformRow({
  row, accounts, sharedEnabled, goldenHours, conflicts, error, showError, todayISO, onChange, onConnect,
}: SchedulePlatformRowProps) {
  const { t } = useApp();
  const [slots, setSlots] = useState<SuggestedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const tag = PLATFORM_TO_TAG[row.platform] ?? row.platform.slice(0, 2);
  const done = row.result?.ok === true;
  const locked = !!row.block || done;
  const modeLabel: Record<RowMode, string> = { NOW: t.planModeNow, SCHEDULE: t.planModeSchedule, SUGGEST: t.planModeSuggest, NONE: t.planModeNone };
  const errorLabel: Record<Exclude<RowError, null>, string> = {
    MISSING_ACCOUNT: t.planErrAccount, MISSING_TIME: t.planErrMissingTime, PAST: t.schErrPast,
  };

  const loadSlots = async () => {
    if (!row.accountId || slotsLoading) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      setSlots(await getSuggestedSlots(row.accountId, 3));
    } catch (e) {
      setSlotsError((e as Error).message);
    } finally {
      setSlotsLoading(false);
    }
  };

  const pickSlot = (slot: SuggestedSlot) => onChange({ date: slot.time.slice(0, 10), time: slot.time.slice(11, 16) });

  const setMode = (mode: RowMode) => {
    onChange({ mode });
    if (mode === 'SUGGEST' && slots === null) void loadSlots();
  };

  return (
    <div style={{ border: `1px solid ${done ? '#bbf7d0' : row.result && !done ? '#f3aabf' : '#ece8f6'}`, borderRadius: 14, padding: '12px 14px', background: locked ? '#fcfbfe' : '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={26} radius={7} fontSize={10.5} />
        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#211c38', flex: 1, minWidth: 120 }}>{PLATFORM_NAME[row.platform] ?? row.platform}</span>
        {!locked && (
          <div role="group" aria-label={t.planModeLabel} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {MODES.map((m) => {
              const on = row.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMode(m)}
                  style={{ ...chip, border: `1px solid ${on ? '#6d28d9' : '#e3d9fb'}`, background: on ? '#6d28d9' : '#f8f5ff', color: on ? '#fff' : '#6d28d9' }}
                >
                  {modeLabel[m]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {row.block && (
        <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 180 }}>{t[`planBlock${row.block}` as keyof typeof t] as string}</span>
          {row.block === 'NO_ACCOUNT' && (
            <button type="button" onClick={onConnect} className="btn-soft" style={{ ...chip, display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #e3d9fb', background: '#fff', color: '#6d28d9' }}>
              <Link2 size={13} aria-hidden="true" />{t.calConnectAccount}
            </button>
          )}
        </div>
      )}

      {!locked && row.mode !== 'NONE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={lbl}>
            {t.planAccount}
            <select value={row.accountId} onChange={(e) => onChange({ accountId: e.target.value })} style={inp} aria-label={`${t.planAccount} — ${PLATFORM_NAME[row.platform]}`}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </label>

          {row.mode === 'SCHEDULE' && !sharedEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <DatePicker
                  value={row.date}
                  min={todayISO}
                  onChange={(v) => onChange({ date: v })}
                  ariaLabel={`${t.schTime} — ${PLATFORM_NAME[row.platform]}`}
                  style={{ flex: 1, borderRadius: 10, border: '1px solid #ece8f6', background: '#fff', padding: '0 12px' }}
                  inputStyle={{ fontSize: 13.5, padding: '9px 0' }}
                />
                <input type="time" value={row.time} onChange={(e) => onChange({ time: e.target.value })} aria-label={`${t.planTimeOfDay} — ${PLATFORM_NAME[row.platform]}`} style={{ ...inp, width: 108, flex: 'none' }} />
              </div>
              {goldenHours.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Sparkles size={13} color="#7c3aed" aria-hidden="true" />
                  {goldenHours.map((h) => {
                    const start = h.split('-')[0]?.trim() ?? '';
                    const on = row.time === start;
                    return (
                      <button key={h} type="button" aria-pressed={on} onClick={() => onChange({ time: start, date: row.date || todayISO })}
                        style={{ ...chip, border: `1px solid ${on ? '#6d28d9' : '#e3d9fb'}`, background: on ? '#6d28d9' : '#f8f5ff', color: on ? '#fff' : '#6d28d9' }}>
                        {h}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {row.mode === 'SCHEDULE' && sharedEnabled && <div style={note}>{t.planUsesShared}</div>}

          {row.mode === 'SUGGEST' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {slotsLoading && <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="icon-spin" aria-hidden="true" />{t.planSuggestLoading}</div>}
              {slotsError && <div style={{ ...note, color: '#e23d6e' }}>{slotsError}</div>}
              {slots && slots.length === 0 && <div style={note}>{t.planSuggestEmpty}</div>}
              {slots && slots.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {slots.map((s) => {
                    const on = row.date === s.time.slice(0, 10) && row.time === s.time.slice(11, 16);
                    return (
                      <button key={s.time} type="button" aria-pressed={on} onClick={() => pickSlot(s)}
                        style={{ ...chip, border: `1px solid ${on ? '#6d28d9' : '#e3d9fb'}`, background: on ? '#6d28d9' : '#f8f5ff', color: on ? '#fff' : '#6d28d9' }}>
                        {s.time.slice(8, 10)}/{s.time.slice(5, 7)} · {s.time.slice(11, 16)}
                      </button>
                    );
                  })}
                </div>
              )}
              {!slotsLoading && (
                <button type="button" onClick={() => void loadSlots()} disabled={!row.accountId} className="link-underline"
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: '#7c3aed', cursor: row.accountId ? 'pointer' : 'default' }}>
                  {t.planSuggestReload}
                </button>
              )}
            </div>
          )}

          {row.mode === 'NOW' && <div style={note}>{t.planNowHint}</div>}

          {conflicts.length > 0 && (
            <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 6, color: '#b45309', background: '#fdf6e7' }}>
              <AlertTriangle size={13} aria-hidden="true" />
              {t.planConflict.replace('{time}', conflicts.map((c) => c.scheduledTime.slice(11, 16)).join(', '))}
            </div>
          )}
          {showError && error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: '#e23d6e' }}>{errorLabel[error]}</div>}
        </div>
      )}

      {row.result && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, fontWeight: 600, color: done ? '#15803d' : '#e23d6e' }}>
          {done ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
          <span>
            {done
              ? (row.result.schedule?.status === 'ON_HOLD' ? t.planHeld : row.result.schedule?.status === 'POSTING' ? t.planPosting
                : t.planOk.replace('{time}', row.result.schedule ? `${row.result.schedule.scheduledTime.slice(11, 16)} ${row.result.schedule.scheduledTime.slice(8, 10)}/${row.result.schedule.scheduledTime.slice(5, 7)}` : ''))
              : row.result.message}
          </span>
        </div>
      )}
    </div>
  );
}

const chip: CSSProperties = { borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#4b4660' };
const inp: CSSProperties = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none' };
const note: CSSProperties = { fontSize: 12.5, color: '#8a85a0', background: '#f7f6fd', borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
