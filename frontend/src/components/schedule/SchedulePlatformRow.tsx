import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Link2, Sparkles, XCircle, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import type { PostSchedule } from '../../api/schedules.ts';
import ScheduleDateField from './ScheduleDateField.tsx';
import ScheduleTimeField from './ScheduleTimeField.tsx';
import ScheduleCalendar from './ScheduleCalendar.tsx';
import ScheduleModeTabs from './ScheduleModeTabs.tsx';
import SuggestedSlots, { useSuggestedSlots } from './SuggestedSlots.tsx';
import type { Dict } from '../../i18n.ts';
import {
  MIN_LEAD_MINUTES, addWallMinutes, bookedDays, calendarStateFor, convertGoldenHours, earliestTimeOn, isSlotPast, pickCalendarDay, rezone, rowBadge,
  wallDiffMinutes, type PlannerAccount, type PlannerRow, type RowBadge, type RowError, type RowMode, type SharedTime,
} from './plannerLogic.ts';
import { C } from '../../styles/colors';

// Một card của SchedulePlanner = một bản nền tảng. Card bị khóa vẫn hiện (mờ) kèm lý do (IG cần ảnh/video, chưa
// định dạng, đã có lịch, chưa kết nối) thay vì ẩn đi; card đủ điều kiện chọn Đăng ngay / Chọn giờ / Gợi ý / Không đăng.
// Card đủ rộng (≥ lg) chia 2 cột: thao tác bên trái, lịch tháng inline bên phải — cả hai đọc/ghi CÙNG row.date/time/mode.

export const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

export interface SchedulePlatformRowProps {
  row: PlannerRow;
  accounts: PlannerAccount[];
  shared: SharedTime;
  /** Khung giờ vàng của nền tảng (theo múi giờ tài khoản — card tự quy đổi sang múi giờ đang chọn). */
  goldenHours: string[];
  conflicts: PostSchedule[];
  /** Lịch hiện có của tài khoản đích (đã quy đổi theo múi giờ đang chọn) — chấm màu trên lịch. */
  accountSchedules: PostSchedule[];
  /** Giờ tường áp cho dòng (đã tính giờ chung) — null khi chưa đủ ngày + giờ hoặc không cần giờ. */
  wall: string | null;
  nowWall: string;
  error: RowError;
  todayISO: string;
  /** Múi giờ đang chọn trong planner / múi giờ tài khoản. */
  zone: string;
  accountZone: string;
  onChange: (patch: Partial<PlannerRow>) => void;
  onConnect: () => void;
  /** Wizard: quay lại bước Hoàn thiện để sửa lý do khóa (thiếu media / chưa định dạng). */
  onFixInFinalize?: () => void;
}

/** "20:00 · 30/09/2026" từ giờ tường yyyy-MM-ddTHH:mm. */
export const wallShort = (wall: string) => `${wall.slice(11, 16)} · ${wall.slice(8, 10)}/${wall.slice(5, 7)}/${wall.slice(0, 4)}`;

export default function SchedulePlatformRow({
  row, accounts, shared, goldenHours, conflicts, accountSchedules, wall, nowWall, error, todayISO, zone, accountZone,
  onChange, onConnect, onFixInFinalize,
}: SchedulePlatformRowProps) {
  const { t } = useApp();
  const [timeBad, setTimeBad] = useState(false);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const tag = PLATFORM_TO_TAG[row.platform] ?? row.platform.slice(0, 2);
  const name = PLATFORM_NAME[row.platform] ?? row.platform;
  const done = row.result?.ok === true;
  const locked = !!row.block || done;
  const timeKind = error === 'PAST' || error === 'TOO_SOON' ? error : null;
  const timeError = timeKind && wall ? timeErrorText(t, timeKind, wall.slice(0, 10), nowWall) : null;
  const suggesting = !locked && row.mode === 'SUGGEST';
  const slots = useSuggestedSlots(row.accountId, zone, todayISO, suggesting);

  // Đổi chế độ / tài khoản → bỏ lọc ngày của gợi ý.
  useEffect(() => { setDayFilter(null); }, [row.mode, row.accountId]);

  const cal = calendarStateFor(row, shared.enabled, todayISO);
  const booked = useMemo(() => bookedDays(accountSchedules, new Set([row.accountId])), [accountSchedules, row.accountId]);
  const suggestedDays = useMemo(() => (suggesting ? new Set((slots.walls ?? []).map((w) => w.slice(0, 10))) : undefined), [suggesting, slots.walls]);
  const hours = useMemo(() => convertGoldenHours(goldenHours, row.date || todayISO, accountZone, zone), [goldenHours, row.date, todayISO, accountZone, zone]);

  const setMode = (mode: RowMode) => onChange({ mode });

  // Bấm ngày trên lịch: Chọn giờ → điền ô ngày; Gợi ý giờ → lọc chip theo ngày (chưa có gợi ý ngày đó → tải từ ngày đó).
  const selectDay = (day: string) => {
    if (row.mode === 'SCHEDULE') {
      const patch = pickCalendarDay(day, todayISO);
      if (patch) onChange(patch);
      return;
    }
    if (row.mode === 'SUGGEST') {
      setDayFilter(day);
      if (!(slots.walls ?? []).some((w) => w.startsWith(day))) slots.loadDay(day);
    }
  };

  // "còn X phút/giờ nữa" dưới chip gợi ý khi giờ hợp lệ.
  const countdown = wall && !error ? relIn(wallDiffMinutes(wall, nowWall), t) : null;
  const fixLabel = row.block === 'UNSUPPORTED_MEDIA' ? t.planFixMedia : row.block === 'NOT_FORMATTED' ? t.planFixFormat : null;
  const resultTime = row.result?.schedule ? rezone(row.result.schedule.scheduledTime, zone) : null;
  const zoneSuffix = zone !== accountZone ? zone : null;

  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: row.block ? 0.6 : 1 }}>
        <span style={{ display: 'inline-flex', filter: row.block ? 'grayscale(.6)' : undefined }}>
          <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={28} radius={8} fontSize={11} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 14.5, color: C.textStrong, flex: 1, minWidth: 90 }}>{name}</span>
        <StatusBadge badge={rowBadge(row, shared, error)} zone={zoneSuffix} />
      </div>

      {row.block && (
        <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>{t[`planBlock${row.block}` as keyof typeof t] as string}</span>
          {row.block === 'NO_ACCOUNT' && (
            <button type="button" onClick={onConnect} className="btn-soft" style={{ ...linkBtn, border: `1px solid ${C.legacyBordere3d9fb}`, background: C.surface, borderRadius: 999, padding: '5px 11px' }}>
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

      {!locked && <ScheduleModeTabs value={row.mode} onChange={setMode} ariaLabel={`${t.planModeLabel} — ${name}`} />}

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

          {row.mode === 'SCHEDULE' && !shared.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={lbl}>{t.schTime}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <ScheduleDateField value={row.date} min={todayISO} onChange={(v) => onChange({ date: v })} schedules={accountSchedules}
                    ariaLabel={`${t.schTime} — ${name}`} invalid={!!timeError} />
                </div>
                <ScheduleTimeField value={row.time} onChange={(v) => onChange({ time: v, date: row.date || todayISO })}
                  ariaLabel={`${t.planTimeOfDay} — ${name}`} invalid={!!timeError} onInvalidChange={setTimeBad}
                  minTime={earliestTimeOn(row.date || todayISO, nowWall)} />
              </div>
              <TimeExtras date={row.date} time={row.time} todayISO={todayISO} nowWall={nowWall} error={timeKind} formatError={timeBad}
                hours={hours} onPick={(start) => onChange({ time: start, date: row.date || todayISO })} />
            </div>
          )}

          {row.mode === 'SCHEDULE' && shared.enabled && (
            <>
              <div style={note}>{t.planUsesShared}</div>
              <TimeFeedback error={timeError} countdown={null} />
            </>
          )}

          {row.mode === 'SUGGEST' && (
            <>
              <SuggestedSlots
                walls={slots.walls}
                loading={slots.loading}
                error={slots.error}
                selected={wall}
                dayFilter={dayFilter}
                canLoad={!!row.accountId}
                onPick={(w) => onChange({ date: w.slice(0, 10), time: w.slice(11, 16) })}
                onMore={slots.more}
                onClearDay={() => setDayFilter(null)}
                onPickDay={(day) => onChange({ mode: 'SCHEDULE', date: day })}
              />
              <TimeFeedback error={timeError} countdown={countdown} />
            </>
          )}

          {row.mode === 'NOW' && (
            <div style={{ ...note, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: C.textStrong }}>
                <Zap size={13} color={C.primary} aria-hidden="true" />{t.planNowConfirm}
              </span>
              <span>{t.planNowHint}</span>
            </div>
          )}

          {conflicts.length > 0 && (
            <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 6, color: C.amberText, background: C.legacyBgfdf6e7 }}>
              <AlertTriangle size={13} aria-hidden="true" />
              {t.planConflict.replace('{time}', conflicts.map((c) => c.scheduledTime.slice(11, 16)).join(', '))}
            </div>
          )}
        </div>
      )}

      {row.result && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, fontWeight: 600, color: done ? C.legacyText15803d : C.rose }}>
          {done ? <CheckCircle2 size={14} aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
          <span>
            {done
              ? (row.result.schedule?.status === 'ON_HOLD' ? t.planHeld : row.result.schedule?.status === 'POSTING' ? t.planPosting
                : t.planOk.replace('{time}', resultTime ? `${resultTime.slice(11, 16)} ${resultTime.slice(8, 10)}/${resultTime.slice(5, 7)}` : ''))
              : row.result.message}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="sch-split-host" style={{ border: `1px solid ${done ? C.legacyBorderbbf7d0 : row.result && !done ? C.inputErrorBorder : C.border}`, borderRadius: 16, padding: '14px 16px', background: row.block ? C.surfaceSubtle : C.surface }}>
      {cal.mode === 'hidden' ? left : (
        <div className="sch-split">
          {left}
          <ScheduleCalendar
            value={row.mode === 'SUGGEST' ? dayFilter ?? row.date : cal.value}
            todayISO={todayISO}
            mode={cal.mode}
            onSelect={selectDay}
            booked={booked}
            suggested={suggestedDays}
            label={t.planCalLabel.replace('{name}', name)}
            notes={row.mode === 'SUGGEST' ? [t.planCalNote, t.planCalNoteSuggest] : [t.planCalNote]}
          />
        </div>
      )}
    </div>
  );
}

/** Badge trạng thái bên phải header: cam = chưa chọn giờ, màu chủ đạo = đã có giờ (kèm múi giờ nếu khác tài khoản). */
export function StatusBadge({ badge, zone }: { badge: RowBadge | null; zone: string | null }) {
  const { t } = useApp();
  if (!badge) return null;
  const tone = badge.kind === 'unset' ? { bg: C.amberSoft, fg: C.amberText }
    : badge.kind === 'blocked' || badge.kind === 'none' ? { bg: C.graySoft, fg: C.textMuted }
    : badge.kind === 'at' && badge.error ? { bg: C.roseSoft, fg: C.rose }
    : { bg: C.primarySoft, fg: C.primaryStrong };
  const text = badge.kind === 'at' ? `${wallShort(badge.wall)}${zone ? ` (${zone})` : ''}`
    : badge.kind === 'now' ? t.planModeNow : badge.kind === 'none' ? t.planModeNone
    : badge.kind === 'blocked' ? t.planWhenBlocked : t.planWhenUnset;
  const IconCmp = badge.kind === 'at' ? CalendarClock : badge.kind === 'now' ? Zap : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: '4px 10px', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
      {IconCmp && <IconCmp size={13} aria-hidden="true" />}{text}
    </span>
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
  /** Khung giờ vàng đã quy đổi theo múi giờ đang chọn. */
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
          style={line.tone === 'error' ? errText : { fontSize: 12, color: line.tone === 'warn' ? C.amberText : C.textMuted }}>
          {line.text}
        </div>
      )}
      {hours.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Sparkles size={13} color={C.primary} aria-hidden="true" />
          {hours.map((h) => {
            const start = h.split('-')[0]?.trim() ?? '';
            const on = time === start;
            const past = isSlotPast(chipDate, start, nowWall);
            return (
              <button key={h} type="button" aria-pressed={on} aria-disabled={past || undefined}
                title={past ? t.planSlotPast : undefined}
                aria-label={past ? `${h} — ${t.planSlotPast}` : undefined}
                onClick={() => { if (!past) onPick(start); }}
                className={on || past ? undefined : 'btn-soft'}
                style={{
                  ...chip,
                  border: `1px solid ${on ? 'transparent' : past ? C.surfaceMuted : C.legacyBordere3d9fb}`,
                  background: on ? 'var(--brand)' : past ? C.bg : C.surfaceMuted,
                  color: on ? C.onBrand : past ? C.textFaint : C.primaryStrong,
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
  if (countdown) return <div style={{ fontSize: 12, color: C.textMuted }}>{countdown}</div>;
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
const lbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 700, color: C.ink650 };
const inp: CSSProperties = { width: '100%', height: 42, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: C.textStrong, background: C.surface, outline: 'none' };
const note: CSSProperties = { fontSize: 12.5, color: C.textMuted, background: C.bg, borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
const errText: CSSProperties = { fontSize: 12, fontWeight: 600, color: C.rose };
const linkBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: C.primaryStrong, cursor: 'pointer' };
