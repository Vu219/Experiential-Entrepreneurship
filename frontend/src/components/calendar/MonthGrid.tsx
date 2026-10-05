import { publishingToday } from '../../utils/publishingTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { weekdays } from '../../data.ts';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import type { PostSchedule } from '../../api/schedules.ts';
import { absDayLabel, dateKey, fmtTime } from './dateUtils.ts';
import { C } from '../../styles/colors';

// Lưới tháng (UI-07 redesign): mỗi ngày hiển thị chip "giờ + màu nền tảng", quá CHIP_LIMIT thì "+N".
// compact (mobile) rút về dot màu như bản cũ. Cell là button: click chọn ngày, điều hướng bằng
// phím mũi tên (roving tabindex), Enter/Space chọn.

export interface MonthCell {
  key: string;
  day: number;
  muted: boolean;
  today: boolean;
  items: { id: string; time: string; bg: string }[];
}

// Lưới tháng thứ Hai-đầu-tuần: cell nào cũng là ngày thật (kể cả muted) để click lọc được.
export function buildMonth(viewDate: Date, schedules: PostSchedule[]): MonthCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Chủ nhật (0) → cột 7
  const start = new Date(year, month, 1 - lead);
  const todayKey = dateKey(publishingToday());

  const itemsByDay = new Map<string, MonthCell['items']>();
  for (const s of schedules) {
    if (s.status === 'CANCELLED') continue;
    const key = s.scheduledTime.slice(0, 10);
    const tag = PLATFORM_TO_TAG[s.platformName] ?? '';
    const list = itemsByDay.get(key) ?? [];
    list.push({ id: s.id, time: fmtTime(s.scheduledTime), bg: PLATFORM_BG[tag] ?? '#6b7280' });
    itemsByDay.set(key, list);
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
      items: itemsByDay.get(key) ?? [],
    });
  }
  return cells;
}

const CHIP_LIMIT = 2;
const ARROW_DELTA: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export default function MonthGrid({ cells, selectedDay, onSelectDay, compact, onSelectSchedule, minDay, disabledLabel }: {
  cells: MonthCell[];
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
  /** Mobile: dot màu thay cho chip giờ. */
  compact: boolean;
  onSelectSchedule?: (scheduleId: string) => void;
  /** Chọn ngày đăng: ngày trước mốc này (yyyy-MM-dd) làm mờ, trỏ chuột "cấm", không chọn được. */
  minDay?: string;
  /** Tooltip / nhãn đọc màn hình cho ngày bị khóa. */
  disabledLabel?: string;
}) {
  const { t, lang } = useApp();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  // Đổi tháng → bỏ vị trí focus cũ (index cũ trỏ sang ngày khác).
  const monthKey = cells[0]?.key;
  useEffect(() => { setFocusIdx(null); }, [monthKey]);

  const defaultIdx = useMemo(() => {
    const today = cells.findIndex((c) => c.today);
    if (today >= 0) return today;
    const firstOfMonth = cells.findIndex((c) => !c.muted);
    return firstOfMonth >= 0 ? firstOfMonth : 0;
  }, [cells]);
  const activeIdx = focusIdx ?? defaultIdx;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = ARROW_DELTA[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = Math.min(cells.length - 1, Math.max(0, activeIdx + delta));
    setFocusIdx(next);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
        {weekdays(lang).map((w, i) => (
          <div key={i} aria-hidden="true" style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: C.textFaint }}>{w}</div>
        ))}
      </div>
      <div onKeyDown={onKeyDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {cells.map((d, i) => {
          const selected = selectedDay === d.key;
          const past = !!minDay && d.key < minDay;
          const chips = compact ? [] : d.items.slice(0, CHIP_LIMIT);
          const extra = d.items.length - chips.length;
          return (
            <button
              key={d.key}
              ref={(el) => { refs.current[i] = el; }}
              tabIndex={i === activeIdx ? 0 : -1}
              onClick={() => { setFocusIdx(i); if (!past) onSelectDay(selected ? null : d.key); }}
              aria-pressed={selected}
              // aria-disabled thay vì disabled: vẫn nhận hover để hiện tooltip + trỏ chuột "cấm", vẫn đi phím mũi tên qua được.
              aria-disabled={past || undefined}
              title={past ? disabledLabel : undefined}
              aria-label={`${absDayLabel(d.key, lang)} · ${past && disabledLabel ? disabledLabel : t.calDayPosts.replace('{n}', String(d.items.length))}`}
              style={{
                font: 'inherit',
                textAlign: 'left',
                minHeight: compact ? 48 : 84,
                borderRadius: 11,
                padding: compact ? '5px 6px' : '6px 7px',
                border: `1px solid ${selected ? C.violetLight : d.today ? C.legacyBorderc4b5fd : past ? 'transparent' : C.surfaceMuted}`,
                background: selected ? C.purpleSoft : d.today ? C.border : past ? C.bg : C.surfaceSubtle,
                opacity: past ? 0.45 : d.muted ? 0.38 : 1,
                cursor: past ? 'not-allowed' : 'pointer',
                minWidth: 0,
              }}
            >
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: d.today || selected ? C.primary : past ? C.legacyTexta39fb3 : C.text }}>{d.day}</span>
              {compact ? (
                <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                  {d.items.slice(0, 4).map((it) => (
                    <span key={it.id} style={{ width: 7, height: 7, borderRadius: '50%', background: it.bg }} />
                  ))}
                </span>
              ) : (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 5 }}>
                  {chips.map((it) => (
                    <span
                      key={it.id}
                      onClick={(e) => {
                        if (onSelectSchedule) {
                          e.stopPropagation();
                          onSelectSchedule(it.id);
                        }
                      }}
                      title={lang === 'en' ? 'Click to view post details' : 'Nhấp để xem chi tiết bài đăng'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: C.surfaceMuted,
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.ink650,
                        lineHeight: 1.4,
                        fontVariantNumeric: 'tabular-nums',
                        cursor: onSelectSchedule ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                      }}
                      className={(onSelectSchedule ? "dm-hover-f1ea0bc" : '')}


                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.bg, flex: 'none' }} />
                      {it.time}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span style={{ background: C.surfaceMuted, borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 800, color: C.textMuted, lineHeight: 1.4, width: 'fit-content' }}>
                      +{extra}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
