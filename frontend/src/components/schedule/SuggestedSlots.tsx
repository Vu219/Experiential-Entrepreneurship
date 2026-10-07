import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarClock, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { getSuggestedSlots } from '../../api/schedules.ts';
import { publishingInstant } from '../../utils/publishingTime.ts';
import { nearestSlotsFrom, rezone, slotsOnDay } from './plannerLogic.ts';
import { C } from '../../styles/colors';

// Chế độ "Gợi ý giờ" của một card nền tảng: chip "30/09 · 20:00" lấy từ GET /schedules/suggested-slots (khung giờ
// vàng còn trống của tài khoản), "Xem lịch khác" tải thêm, lọc theo ngày bấm trên lịch tháng.

const PAGE = 3;
const dm = (wall: string) => `${wall.slice(8, 10)}/${wall.slice(5, 7)}`;

/**
 * Gợi ý của tài khoản {@code accountId}: giữ instant gốc (đổi tài khoản → tải lại), hiển thị thành giờ tường theo
 * {@code zone} đang chọn. Chỉ tự tải khi {@code active} (đang ở chế độ Gợi ý giờ).
 */
export function useSuggestedSlots(accountId: string, zone: string, todayISO: string, active: boolean) {
  const [raw, setRaw] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  const fetchSlots = useCallback(async (from: string | undefined, reset: boolean) => {
    if (!accountId) return;
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const slots = await getSuggestedSlots(accountId, PAGE, from);
      if (id !== req.current) return;
      setRaw((prev) => {
        const byInstant = new Map((reset ? [] : prev ?? []).map((s) => [Date.parse(s), s]));
        slots.forEach((s) => byInstant.set(Date.parse(s.time), s.time));
        return [...byInstant.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
      });
    } catch (e) {
      if (id === req.current) setError((e as Error).message);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [accountId]);

  // Đổi tài khoản đích → gợi ý cũ không còn đúng.
  useEffect(() => {
    req.current++;
    setRaw(null);
    setError(null);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    if (active && accountId && raw === null && !loading && !error) void fetchSlots(undefined, true);
  }, [active, accountId, raw, loading, error, fetchSlots]);

  const walls = useMemo(() => raw?.map((s) => rezone(s, zone).slice(0, 16)) ?? null, [raw, zone]);

  /** Thêm gợi ý sau gợi ý cuối cùng đang có. */
  const more = () => {
    const last = raw?.[raw.length - 1];
    void fetchSlots(last ? new Date(Date.parse(last) + 60_000).toISOString() : undefined, false);
  };

  /** Tải gợi ý bắt đầu từ ngày {@code day} (theo múi giờ đang chọn) — bấm một ngày chưa có gợi ý trên lịch. */
  const loadDay = (day: string) => {
    let from: string | undefined;
    try {
      from = day > todayISO ? publishingInstant(`${day}T00:00`, zone) : undefined;
    } catch {
      from = undefined;
    }
    void fetchSlots(from, false);
  };

  return { walls, loading, error, more, loadDay, reload: () => void fetchSlots(undefined, true) };
}

export default function SuggestedSlots({ walls, loading, error, selected, dayFilter, canLoad, onPick, onMore, onClearDay, onPickDay }: {
  /** Gợi ý dạng giờ tường yyyy-MM-ddTHH:mm (null = chưa tải). */
  walls: string[] | null;
  loading: boolean;
  error: string | null;
  /** Giờ tường đang chọn của dòng. */
  selected: string | null;
  /** Ngày đang lọc (bấm trên lịch) — null = mọi gợi ý. */
  dayFilter: string | null;
  canLoad: boolean;
  onPick: (wall: string) => void;
  onMore: () => void;
  onClearDay: () => void;
  /** Ngày lọc không còn khung trống → chuyển sang Chọn giờ với ngày đó. */
  onPickDay: (day: string) => void;
}) {
  const { t } = useApp();
  const all = walls ?? [];
  const onDay = dayFilter ? slotsOnDay(all, dayFilter) : all;
  const missDay = !!dayFilter && !loading && onDay.length === 0;
  const visible = missDay ? nearestSlotsFrom(all, dayFilter!) : onDay;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={lbl}>
          <Sparkles size={13} color={C.primary} aria-hidden="true" />
          {dayFilter ? t.planSuggestDay.replace('{date}', dm(dayFilter)) : t.planSuggestTitle}
        </span>
        {dayFilter && (
          <button type="button" onClick={onClearDay} className="link-underline" style={linkBtn}>{t.planSuggestAll}</button>
        )}
      </div>

      {missDay && (
        <div style={{ ...note, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>{t.planSuggestDayNone.replace('{date}', dm(dayFilter!))}</span>
          <button type="button" onClick={() => onPickDay(dayFilter!)} className="link-underline" style={{ ...linkBtn, alignSelf: 'flex-start' }}>
            <CalendarClock size={13} aria-hidden="true" />{t.planSuggestPickDay.replace('{date}', dm(dayFilter!))}
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {visible.map((w) => {
            const on = selected === w;
            return (
              <button key={w} type="button" aria-pressed={on} onClick={() => onPick(w)}
                className={on ? undefined : 'btn-soft'}
                style={{ ...chip, border: `1px solid ${on ? 'transparent' : C.legacyBordere3d9fb}`, background: on ? 'var(--brand)' : C.surfaceMuted, color: on ? C.onBrand : C.primaryStrong }}>
                {dm(w)} · {w.slice(11, 16)}
              </button>
            );
          })}
        </div>
      )}

      {loading && <div style={{ ...note, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="icon-spin" aria-hidden="true" />{t.planSuggestLoading}</div>}
      {error && <div role="alert" style={{ ...note, color: C.rose }}>{error}</div>}
      {walls && walls.length === 0 && !loading && !dayFilter && <div style={note}>{t.planSuggestEmpty}</div>}

      {!loading && canLoad && (
        <button type="button" onClick={onMore} className="link-underline" style={{ ...linkBtn, alignSelf: 'flex-start' }}>
          {t.planSuggestMore}<ChevronDown size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const lbl: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.ink650 };
const chip: CSSProperties = { borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' };
const note: CSSProperties = { fontSize: 12.5, color: C.textMuted, background: C.bg, borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
const linkBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: C.primary, cursor: 'pointer' };
