import { useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { WEEKDAYS_FULL } from '../calendar/dateUtils.ts';
import { getSuggestedSlots, type PostSchedule, type SuggestedSlot } from '../../api/schedules.ts';
import ScheduleDateField from './ScheduleDateField.tsx';
import ScheduleTimeField from './ScheduleTimeField.tsx';
import type { Dict } from '../../i18n.ts';
import {
  MIN_LEAD_MINUTES, addWallMinutes, earliestTimeOn, isSlotPast, wallDiffMinutes,
  type PlannerAccount, type PlannerRow, type RowError, type RowMode,
} from './plannerLogic.ts';

// Một card của SchedulePlanner = một bản nền tảng. Card bị khóa vẫn hiện (mờ) kèm lý do (IG cần ảnh/video, chưa
// định dạng, đã có lịch, chưa kết nối) thay vì ẩn đi; card đủ điều kiện chọn Đăng ngay / Chọn giờ / Gợi ý / Không đăng.

export const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };
const MODES: RowMode[] = ['NOW', 'SCHEDULE', 'SUGGEST', 'NONE'];

export interface SchedulePlatformRowProps {
  row: PlannerRow;
  accounts: PlannerAccount[];
  sharedEnabled: boolean;
  goldenHours: string[];
  conflicts: PostSchedule[];
  /** Lịch hiện có của tài khoản đích — chấm màu trên lịch chọn ngày. */
  accountSchedules: PostSchedule[];
  /** Giờ tường áp cho dòng (đã tính giờ chung) — null khi chưa đủ ngày + giờ hoặc không cần giờ. */
  wall: string | null;
  nowWall: string;
  error: RowError;
  todayISO: string;
  onChange: (patch: Partial<PlannerRow>) => void;
  onConnect: () => void;
  /** Wizard: quay lại bước Hoàn thiện để sửa lý do khóa (thiếu media / chưa định dạng). */
  onFixInFinalize?: () => void;
}

/** "18:34 · Thứ Tư, 30/09/2026" từ giờ tường yyyy-MM-ddTHH:mm. */
export function wallLabel(wall: string, lang: 'vi' | 'en'): { time: string; date: string } {
  const [y, m, d] = [+wall.slice(0, 4), +wall.slice(5, 7), +wall.slice(8, 10)];
  const weekday = WEEKDAYS_FULL[lang][(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
  return { time: wall.slice(11, 16), date: `${weekday}, ${wall.slice(8, 10)}/${wall.slice(5, 7)}/${wall.slice(0, 4)}` };
}

export default function SchedulePlatformRow({
  row, accounts, sharedEnabled, goldenHours, conflicts, accountSchedules, wall, nowWall, error, todayISO,
  onChange, onConnect, onFixInFinalize,
}: SchedulePlatformRowProps) {
  const { t, lang } = useApp();
  const [slots, setSlots] = useState<SuggestedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [timeBad, setTimeBad] = useState(false);
  const tag = PLATFORM_TO_TAG[row.platform] ?? row.platform.slice(0, 2);
  const name = PLATFORM_NAME[row.platform] ?? row.platform;
  const done = row.result?.ok === true;
  const locked = !!row.block || done;
  const modeLabel: Record<RowMode, string> = { NOW: t.planModeNow, SCHEDULE: t.planModeSchedule, SUGGEST: t.planModeSuggest, NONE: t.planModeNone };
  const timeKind = error === 'PAST' || error === 'TOO_SOON' ? error : null;
  const timeError = timeKind && wall ? timeErrorText(t, timeKind, wall.slice(0, 10), nowWall) : null;

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

  // Tóm tắt bên phải header: nhìn là biết nền tảng này sẽ đăng lúc nào.
  const summary = (() => {
    if (row.block) return { text: t.planWhenBlocked, color: '#a59fbb' };
    if (done) return null;
    if (row.mode === 'NONE') return { text: t.planModeNone, color: '#8a85a0' };
    if (row.mode === 'NOW') return { text: t.planModeNow, color: '#6d28d9' };
    if (!wall) return { text: t.planWhenUnset, color: '#b45309' };
    const l = wallLabel(wall, lang);
    return { text: t.planWhenAt.replace('{time}', l.time).replace('{date}', l.date), color: error ? '#e23d6e' : '#15803d' };
  })();

  // "còn X phút/giờ nữa" dưới ô giờ khi giờ hợp lệ.
  const countdown = wall && !error ? relIn(wallDiffMinutes(wall, nowWall), t) : null;

  const fixLabel = row.block === 'UNSUPPORTED_MEDIA' ? t.planFixMedia : row.block === 'NOT_FORMATTED' ? t.planFixFormat : null;

  return (
    <div style={{ border: `1px solid ${done ? '#bbf7d0' : row.result && !done ? '#f3aabf' : '#ece8f6'}`, borderRadius: 16, padding: '14px 16px', background: row.block ? '#fbfaff' : '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: row.block ? 0.6 : 1 }}>
        <span style={{ display: 'inline-flex', filter: row.block ? 'grayscale(.6)' : undefined }}>
          <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={28} radius={8} fontSize={11} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38', flex: 1, minWidth: 100 }}>{name}</span>
        {summary && <span style={{ fontSize: 12.5, fontWeight: 700, color: summary.color, textAlign: 'right' }}>{summary.text}</span>}
      </div>

      {row.block && (
        <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>{t[`planBlock${row.block}` as keyof typeof t] as string}</span>
          {row.block === 'NO_ACCOUNT' && (
            <button type="button" onClick={onConnect} className="btn-soft" style={{ ...linkBtn, border: '1px solid #e3d9fb', background: '#fff', borderRadius: 999, padding: '5px 11px' }}>
              <Link2 size={13} aria-hidden="true" />{t.calConnectAccount}
            </button>
          )}
          {fixLabel && onFixInFinalize && (
            <button type="button" onClick={onFixInFinalize} className="link-underline" style={linkBtn}>
              <ArrowLeft size={13} aria-hidden="true" />{fixLabel}
            </button>
          )}
        </div>
      )}

      {!locked && (
        <div role="group" aria-label={`${t.planModeLabel} — ${name}`} style={segmented}>
          {MODES.map((m) => {
            const on = row.mode === m;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => setMode(m)}
                style={{ ...segment, background: on ? '#fff' : 'transparent', color: on ? '#6d28d9' : '#6b6680', boxShadow: on ? '0 2px 8px -3px rgba(80,40,140,.35)' : 'none' }}>
                {modeLabel[m]}
              </button>
            );
          })}
        </div>
      )}

      {!locked && row.mode !== 'NONE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={lbl}>
            {t.planAccount}
            <select value={row.accountId} onChange={(e) => onChange({ accountId: e.target.value })} style={inp} aria-label={`${t.planAccount} — ${name}`}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </label>
          {error === 'MISSING_ACCOUNT' && <div style={errText}>{t.planErrAccount}</div>}

          {row.mode === 'SCHEDULE' && !sharedEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={lbl}>{t.schTime}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <ScheduleDateField value={row.date} min={todayISO} onChange={(v) => onChange({ date: v })} schedules={accountSchedules}
                    ariaLabel={`${t.schTime} — ${name}`} invalid={!!timeError} />
                </div>
                <ScheduleTimeField value={row.time} onChange={(v) => onChange({ time: v, date: row.date || todayISO })}
                  ariaLabel={`${t.planTimeOfDay} — ${name}`} invalid={!!timeError} onInvalidChange={setTimeBad}
                  minTime={earliestTimeOn(row.date || todayISO, nowWall)} />
              </div>
              <TimeExtras date={row.date} time={row.time} todayISO={todayISO} nowWall={nowWall} error={timeKind} formatError={timeBad}
                hours={goldenHours} onPick={(start) => onChange({ time: start, date: row.date || todayISO })} />
            </div>
          )}

          {row.mode === 'SCHEDULE' && sharedEnabled && (
            <>
              <div style={note}>{t.planUsesShared}</div>
              <TimeFeedback error={timeError} countdown={null} />
            </>
          )}

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
              <TimeFeedback error={timeError} countdown={countdown} />
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

/** Lỗi giờ đăng theo ngữ cảnh: ngày hôm nay thì nói rõ giờ sớm nhất còn chọn được. */
export function timeErrorText(t: Dict, kind: 'PAST' | 'TOO_SOON', date: string, nowWall: string): string {
  const earliest = earliestTimeOn(date, nowWall);
  if (earliest === 'OVER') return t.planTodayOver;
  if (kind === 'TOO_SOON') {
    return t.schErrTooSoon.replace('{n}', String(MIN_LEAD_MINUTES)).replace('{time}', earliest ?? addWallMinutes(nowWall, MIN_LEAD_MINUTES).slice(11, 16));
  }
  return earliest ? t.schErrPastToday.replace('{time}', earliest) : t.schErrPast;
}

/**
 * Phần dưới hàng ngày + giờ: lỗi (đỏ) → nhắc giờ sớm nhất nếu đang chọn hôm nay → "còn X nữa"; rồi chip khung giờ
 * vàng. Chip đã qua (hôm nay) bị làm mờ, trỏ chuột "cấm", không bấm được, có tooltip giải thích.
 */
export function TimeExtras({ date, time, todayISO, nowWall, error, formatError, hours, onPick }: {
  /** Ngày đang chọn ('' = chưa chọn — chip sẽ đặt ngày hôm nay). */
  date: string;
  time: string;
  todayISO: string;
  nowWall: string;
  error: 'PAST' | 'TOO_SOON' | null;
  /** Chữ gõ trong ô giờ không phải HH:mm hợp lệ. */
  formatError: boolean;
  hours: string[];
  onPick: (start: string) => void;
}) {
  const { t } = useApp();
  const chipDate = date || todayISO;
  const earliest = date === todayISO ? earliestTimeOn(date, nowWall) : null;
  const wall = date && time ? `${date}T${time}` : null;
  let line: { text: string; tone: 'error' | 'warn' | 'muted' } | null = null;
  if (formatError) line = { text: t.planTimeInvalid, tone: 'error' };
  else if (error) line = { text: timeErrorText(t, error, date, nowWall), tone: 'error' };
  else if (earliest === 'OVER') line = { text: t.planTodayOver, tone: 'warn' };
  else if (!time && earliest) line = { text: t.planEarliestToday.replace('{time}', earliest), tone: 'muted' };
  else if (wall) {
    const rel = relIn(wallDiffMinutes(wall, nowWall), t);
    if (rel) line = { text: rel, tone: 'muted' };
  }
  return (
    <>
      {line && (
        <div role={line.tone === 'error' ? 'alert' : undefined}
          style={line.tone === 'error' ? errText : { fontSize: 12, color: line.tone === 'warn' ? '#b45309' : '#8a85a0' }}>
          {line.text}
        </div>
      )}
      {hours.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Sparkles size={13} color="#7c3aed" aria-hidden="true" />
          {hours.map((h) => {
            const start = h.split('-')[0]?.trim() ?? '';
            const on = time === start;
            const past = isSlotPast(chipDate, start, nowWall);
            return (
              <button key={h} type="button" aria-pressed={on} aria-disabled={past || undefined}
                title={past ? t.planSlotPast : undefined}
                aria-label={past ? `${h} — ${t.planSlotPast}` : undefined}
                onClick={() => { if (!past) onPick(start); }}
                style={{
                  ...chip,
                  border: `1px solid ${on ? '#6d28d9' : past ? '#ece9f3' : '#e3d9fb'}`,
                  background: on ? '#6d28d9' : past ? '#f4f3f8' : '#f8f5ff',
                  color: on ? '#fff' : past ? '#aaa5bb' : '#6d28d9',
                  cursor: past ? 'not-allowed' : 'pointer',
                  opacity: past ? 0.7 : 1,
                }}>
                {h}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Lỗi giờ (đỏ, đọc ngay bởi screen reader) hoặc dòng phụ "còn X nữa". */
export function TimeFeedback({ error, countdown }: { error: string | null; countdown: string | null }) {
  if (error) return <div role="alert" style={errText}>{error}</div>;
  if (countdown) return <div style={{ fontSize: 12, color: '#8a85a0' }}>{countdown}</div>;
  return null;
}

/** "còn 45 phút nữa" / "còn 3 giờ 20 phút nữa" / "còn 2 ngày 4 giờ nữa". */
export function relIn(minutes: number, t: { planIn: string; planUnitMin: string; planUnitHour: string; planUnitDay: string }): string | null {
  if (minutes <= 0) return null;
  const unit = (key: string, n: number) => key.replace('{n}', String(n));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = days > 0
    ? [unit(t.planUnitDay, days), hours ? unit(t.planUnitHour, hours) : '']
    : hours > 0 ? [unit(t.planUnitHour, hours), mins ? unit(t.planUnitMin, mins) : ''] : [unit(t.planUnitMin, mins)];
  return t.planIn.replace('{n}', parts.filter(Boolean).join(' '));
}

const chip: CSSProperties = { borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' };
const segmented: CSSProperties = { display: 'flex', gap: 3, padding: 3, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, flexWrap: 'wrap' };
const segment: CSSProperties = { flex: '1 1 0', minWidth: 88, border: 'none', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#4b4660' };
const inp: CSSProperties = { width: '100%', height: 42, border: '1px solid #ece8f6', borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none' };
const note: CSSProperties = { fontSize: 12.5, color: '#8a85a0', background: '#f7f6fd', borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
const errText: CSSProperties = { fontSize: 12, fontWeight: 600, color: '#e23d6e' };
const linkBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: '#6d28d9', cursor: 'pointer' };
