import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayISO } from './dateRange';

/**
 * Lịch chọn KHOẢNG ngày (dự án chỉ có `DatePicker` chọn MỘT ngày). Dùng lại y hệt cách dựng lưới
 * tháng + nhãn thứ/tháng i18n của `DatePicker` — không thêm thư viện (quyết định D5 của Analytics v2).
 *
 * Bấm lần 1 đặt ngày bắt đầu, lần 2 đặt ngày kết thúc (chọn ngược thì tự đảo). Chỉ khi đã đủ hai
 * đầu mới gọi `onChange` — trang không phải fetch lại giữa chừng.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const firstDow = (y: number, m: number) => new Date(y, m, 1).getDay();

export default function RangeCalendar({
  from,
  to,
  max = todayISO(),
  onChange,
}: {
  from: string;
  to: string;
  /** Ngày lớn nhất chọn được (mặc định hôm nay — không có số liệu tương lai). */
  max?: string;
  onChange: (from: string, to: string) => void;
}) {
  const { t } = useApp();
  const start = useMemo(() => parseISO(from), [from]);
  const [view, setView] = useState({ year: start.year, month: start.month });
  // Đầu neo khi đang chọn dở (đã bấm 1 ngày, chờ ngày thứ hai).
  const [pending, setPending] = useState<string | null>(null);

  // Khoảng đổi từ ngoài (bấm preset) → nhảy lịch về tháng chứa ngày bắt đầu.
  useEffect(() => {
    const p = parseISO(from);
    setView({ year: p.year, month: p.month });
    setPending(null);
  }, [from]);

  const monthNames = t.dpMonths.split(',');
  const weekDays = [t.dpSun, t.dpMon, t.dpTue, t.dpWed, t.dpThu, t.dpFri, t.dpSat];

  const step = (delta: number) => setView((v) => {
    const m = v.month + delta;
    if (m < 0) return { year: v.year - 1, month: 11 };
    if (m > 11) return { year: v.year + 1, month: 0 };
    return { year: v.year, month: m };
  });

  const pick = (iso: string) => {
    if (!pending) { setPending(iso); return; }
    const [a, b] = pending <= iso ? [pending, iso] : [iso, pending];
    setPending(null);
    onChange(a, b);
  };

  // Lưới: ngày tháng trước/sau chỉ để lấp chỗ (disabled), giống DatePicker.
  const total = daysInMonth(view.year, view.month);
  const lead = firstDow(view.year, view.month);
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => toISO(view.year, view.month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rangeFrom = pending ?? from;
  const rangeTo = pending ?? to;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => step(-1)} aria-label={t.anaPrevPage} style={navBtn}>
          <ChevronLeft size={16} color="#6b6680" strokeWidth={2} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#211c38' }}>
          {monthNames[view.month]} {view.year}
        </div>
        <button type="button" onClick={() => step(1)} aria-label={t.anaNextPage} style={navBtn}>
          <ChevronRight size={16} color="#6b6680" strokeWidth={2} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {weekDays.map((wd) => (
          <div key={wd} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#a39bbf' }}>{wd}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((iso, idx) => {
          if (!iso) return <span key={`e${idx}`} />;
          const disabled = iso > max;
          const isEdge = iso === rangeFrom || iso === rangeTo;
          const inRange = iso > rangeFrom && iso < rangeTo;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-pressed={isEdge}
              onClick={() => pick(iso)}
              style={{
                ...dayCell,
                cursor: disabled ? 'default' : 'pointer',
                color: disabled ? '#d0cce0' : isEdge ? '#fff' : '#3f3a55',
                background: isEdge ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : inRange ? '#f3edff' : 'transparent',
                fontWeight: isEdge ? 800 : 600,
              }}
              onMouseEnter={(e) => { if (!disabled && !isEdge && !inRange) e.currentTarget.style.background = '#f6f3fc'; }}
              onMouseLeave={(e) => { if (!isEdge && !inRange) e.currentTarget.style.background = 'transparent'; }}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const navBtn: CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f6f3fc',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

const dayCell: CSSProperties = {
  height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 9, fontSize: 13, border: 'none', transition: 'background .15s',
};
