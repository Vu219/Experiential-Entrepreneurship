import { Fragment } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * Heatmap N ngày × 24 giờ thuần div (cùng triết lý BarChart — không thêm thư viện).
 * Bucket theo GIỜ VIỆT NAM (backend rollup đã chốt quy ước). Ô đậm dần theo giá trị
 * so max; null/không dữ liệu = ô nhạt.
 *
 * Bố cục full-width (UI refactor): lưới grid `repeat(24, 1fr)` giãn hết chiều rộng
 * card (ô chữ nhật, không cố định px); mép phải có TỔNG THEO NGÀY (mini bar ngang),
 * dưới lưới có TỔNG THEO GIỜ (mini bar dọc) + dải chỉ số tóm tắt (giờ cao/thấp điểm,
 * tổng kỳ, TB/giờ, cảnh báo hoạt động 0h–5h). Legend 5 bậc căn phải trên lưới.
 */
export interface HeatCell {
  /** ISO datetime của bucket giờ (giờ VN), vd "2026-07-18T03:00:00". */
  bucket: string;
  value: number | null;
}

const LEGEND_STEPS = 5;
/** Ngưỡng cảnh báo hoạt động ngoài giờ: ≥20% tổng kỳ rơi vào 0h–5h. */
const NIGHT_WARN_PCT = 20;

export default function Heatmap({
  cells,
  days = 7,
  color = '139, 92, 246', // rgb của tím brand (#8b5cf6)
  fmt = (v: number) => v.toLocaleString('vi-VN'),
  legend,
}: {
  cells: HeatCell[];
  days?: number;
  /** "r, g, b" — alpha nội suy theo giá trị. */
  color?: string;
  fmt?: (v: number) => string;
  /** Truyền nhãn hai đầu ({low: 'Ít', high: 'Nhiều'}) để hiện thang màu 5 bậc căn phải
      phía trên lưới — đơn vị theo `fmt` của metric đang chọn (mục 5a). */
  legend?: { low: string; high: string };
}) {
  const { t, lang } = useApp();

  // key "YYYY-MM-DDTHH" → value
  const byHour = new Map<string, number>();
  for (const c of cells) {
    if (c.value !== null) byHour.set(c.bucket.slice(0, 13), c.value);
  }
  const max = Math.max(...byHour.values(), 1);

  // N ngày gần nhất, cũ nhất trên cùng.
  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const WEEKDAYS = lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayLabel = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${WEEKDAYS[d.getDay()]}`;
  const cellValue = (d: Date, h: number) => byHour.get(`${dayKey(d)}T${String(h).padStart(2, '0')}`);

  // ===== Tổng theo ngày / theo giờ + chỉ số tóm tắt =====
  const dayTotals = dates.map((d) => {
    let s = 0;
    for (let h = 0; h < 24; h++) s += cellValue(d, h) ?? 0;
    return s;
  });
  const hourTotals = Array.from({ length: 24 }, (_, h) =>
    dates.reduce((s, d) => s + (cellValue(d, h) ?? 0), 0));
  const grand = dayTotals.reduce((a, b) => a + b, 0);
  const maxDayTotal = Math.max(...dayTotals, 1);
  const maxHourTotal = Math.max(...hourTotals, 1);
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const quietHour = hourTotals.indexOf(Math.min(...hourTotals));
  const nightTotal = hourTotals.slice(0, 6).reduce((a, b) => a + b, 0); // 0h–5h
  const nightPct = grand > 0 ? (nightTotal / grand) * 100 : 0;

  // Lưới: [nhãn ngày 64px] + 24 cột ô GẦN VUÔNG (rộng 14–28px, cao 22px) + [tổng ngày 64px].
  // KHÔNG giãn hết card: khối lưới rộng tối đa 24×(28+gap), phần card dư để trống và
  // toàn khối căn giữa (margin auto); màn hẹp ô co về 14px, hẹp nữa thì cuộn ngang.
  const gridCols = '64px repeat(24, minmax(14px, 28px)) 64px';
  // TB/giờ = Tổng kỳ ÷ (days × 24). Làm tròn khi ≥10 để fmt không hiển thị phần thập
  // phân kiểu vi-VN ("346,429" bị đọc nhầm thành 346 nghìn); giá trị nhỏ (vd chi phí
  // USD) giữ nguyên cho fmt của metric tự định dạng.
  const avgPerHour = grand / (days * 24);
  const avgDisplay = fmt(avgPerHour >= 10 ? Math.round(avgPerHour) : avgPerHour);
  const summaryItem = (label: string, value: string) => (
    <span key={label} style={{ fontSize: 12, color: '#8a85a0' }}>
      {label}: <b style={{ color: '#3f3a55' }}>{value}</b>
    </span>
  );

  return (
    <div>
      {/* Legend thang màu 5 bậc, căn phải ngay dưới tiêu đề/nhóm nút metric của card:
          Ít → Nhiều + giá trị thực của bậc cao nhất, đổi đơn vị theo tab qua `fmt`. */}
      {legend && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 10, fontSize: 11.5, color: '#8a85a0', fontWeight: 600, flexWrap: 'wrap' }}>
          <span>{legend.low}</span>
          {Array.from({ length: LEGEND_STEPS }, (_, i) => (
            <span key={i} style={{ width: 16, height: 12, borderRadius: 3, background: `rgba(${color}, ${0.12 + 0.88 * ((i + 0.5) / LEGEND_STEPS)})` }} />
          ))}
          <span>{legend.high}</span>
          <span style={{ marginLeft: 6, color: '#a59fbb' }}>0 – {fmt(max)}</span>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        {/* MỘT grid duy nhất cho mọi hàng (ngày × ô × tổng ngày, hàng Σ giờ, hàng nhãn
            giờ) — nhãn mốc 0/3/6… nằm CHÍNH XÁC dưới cột của nó, không định vị tay.
            width fit-content + margin auto: căn giữa toàn khối trong card. */}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 3, alignItems: 'center', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
          {dates.map((d, di) => (
            <Fragment key={dayKey(d)}>
              <span style={{ fontSize: 11, color: '#8a85a0', fontWeight: 600, whiteSpace: 'nowrap' }}>{dayLabel(d)}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const v = cellValue(d, h);
                const alpha = v === undefined ? 0 : 0.12 + 0.88 * (v / max);
                return (
                  <div
                    key={h}
                    title={`${dayLabel(d)} · ${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 — ${v === undefined ? '—' : fmt(v)}`}
                    style={{
                      height: 22, borderRadius: 4, minWidth: 0,
                      background: v === undefined ? '#f4f1fa' : `rgba(${color}, ${alpha})`,
                    }}
                  />
                );
              })}
              {/* Tổng theo ngày — mini bar ngang ở mép phải lưới */}
              <div title={`${dayLabel(d)} — ${fmt(dayTotals[di])}`} style={{ height: 8, borderRadius: 999, background: '#f4f1fa', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(dayTotals[di] / maxDayTotal) * 100}%`, borderRadius: 999, background: `rgba(${color}, .75)` }} />
              </div>
            </Fragment>
          ))}

          {/* Tổng theo giờ — mini bar dọc dưới lưới */}
          <span style={{ fontSize: 10, color: '#a59fbb', alignSelf: 'end' }}>Σ</span>
          {hourTotals.map((v, h) => (
            <div key={`sum-${h}`} title={`${String(h).padStart(2, '0')}:00 — ${fmt(v)}`} style={{ height: 26, display: 'flex', alignItems: 'flex-end', minWidth: 0, alignSelf: 'end' }}>
              <div style={{ width: '100%', height: `${Math.max(v > 0 ? 8 : 0, (v / maxHourTotal) * 100)}%`, borderRadius: 3, background: `rgba(${color}, .55)` }} />
            </div>
          ))}
          <span />

          {/* Nhãn giờ mỗi 3 cột — cùng hệ grid nên căn giữa đúng cột */}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={`tick-${h}`} style={{ fontSize: 10, color: '#a59fbb', textAlign: 'center', minWidth: 0 }}>
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          <span />
        </div>
      </div>

      {/* Dải chỉ số tóm tắt — căn giữa cùng trục với khối lưới */}
      {grand > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6px 20px', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1eef8' }}>
          {summaryItem(t.hmPeak, `${String(peakHour).padStart(2, '0')}:00 · ${fmt(hourTotals[peakHour])}`)}
          {summaryItem(t.hmQuiet, `${String(quietHour).padStart(2, '0')}:00`)}
          {summaryItem(t.hmTotal, fmt(grand))}
          {summaryItem(t.hmAvgHour, avgDisplay)}
          {nightPct >= NIGHT_WARN_PCT && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '3px 10px' }}>
              {t.hmNightWarn.replace('{p}', nightPct.toFixed(0))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
