import { memo, useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatGroupedNumber } from '../../utils/format';
import RangeBadge from './RangeBadge';
import type { AnalyticsHeatmap, AnalyticsHeatmapCell } from '../../api/analytics';

/**
 * Khối G — "Thời điểm hoạt động nhiều nhất": lưới 7 thứ × 8 khung 3 giờ, tô màu theo **tương tác
 * trung bình mỗi bài** (không phải tổng — tổng chỉ phản ánh tần suất đăng).
 *
 * Ba trạng thái ô KHÁC NGHĨA, không được vẽ giống nhau:
 * 1. **Không có trong `cells`** → chưa từng đăng khung đó: nền trung tính, NGOÀI thang màu.
 * 2. **`lowSample`** (0 < posts < `minPostsForScale`) → có màu nhưng viền nét đứt + mờ: đã đăng
 *    nhưng mẫu quá nhỏ để tin.
 * 3. Ô đủ mẫu → màu theo thang `min`…`max` (backend chỉ tính thang trên ô đủ mẫu).
 *
 * Vẽ bằng CSS grid, không thêm thư viện. Card nằm ở cột 4 (≥1280) nên ô thu nhỏ còn ~20×16px, nhãn
 * giờ ở trên, nhãn thứ ở trái; dưới 1280 card xuống full width nên ô tự giãn rộng ra. Màn hẹp hơn
 * `minWidth` thì container cuộn ngang, cột nhãn thứ dính bên trái làm mốc.
 */
function ActivityHeatmap({ data, from, to }: { data: AnalyticsHeatmap; from: string; to: string }) {
  const { t, lang } = useApp();
  const [hover, setHover] = useState<{ cell: AnalyticsHeatmapCell; x: number; y: number } | null>(null);

  const dowLabel = [t.anaDow1, t.anaDow2, t.anaDow3, t.anaDow4, t.anaDow5, t.anaDow6, t.anaDow7];
  const slotLabel = [t.anaSlot0, t.anaSlot1, t.anaSlot2, t.anaSlot3, t.anaSlot4, t.anaSlot5, t.anaSlot6, t.anaSlot7];

  // Backend chỉ trả ô CÓ bài → tra cứu theo khoá "dow-slot", ô vắng mặt là "chưa từng đăng".
  const byKey = useMemo(() => {
    const map = new Map<string, AnalyticsHeatmapCell>();
    data.cells.forEach((c) => map.set(`${c.dow}-${c.slot}`, c));
    return map;
  }, [data.cells]);

  const hasAnyPost = data.cells.length > 0;
  const { max, min, minPostsForScale, scaledCells } = data;

  /** Màu ô đủ mẫu: nội suy trên dải tím thương hiệu theo vị trí trong thang min…max. */
  const colorOf = (cell: AnalyticsHeatmapCell): string => {
    if (max === null || min === null || max === min) return 'rgba(139,92,246,.45)';
    const ratio = Math.min(1, Math.max(0, (cell.avgEngagement - min) / (max - min)));
    return `rgba(139,92,246,${0.14 + ratio * 0.76})`;
  };

  const cellAria = (cell: AnalyticsHeatmapCell | undefined, dow: number, slot: number) => {
    const where = `${dowLabel[dow - 1]} ${slotLabel[slot]}`;
    if (!cell) return `${where} — ${t.anaHeatNoPost}`;
    return `${where} — ${t.anaHeatCellAvg.replace('{v}', formatGroupedNumber(Math.round(cell.avgEngagement), lang))}, ${t.anaHeatCellPosts.replace('{n}', String(cell.posts))}`;
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaHeatmapTitle}</div>
          <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 2 }}>{t.anaHeatmapSub}</div>
        </div>
        <RangeBadge from={from} to={to} />
      </div>

      {!hasAnyPost ? (
        <div style={{
          height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: 13.5, color: '#8a85a0', padding: '0 20px',
        }}>
          {t.anaHeatmapEmpty}
        </div>
      ) : (
        <>
          {/* Ô thu nhỏ để lưới 8 cột giờ × 7 hàng thứ vừa cột 4; `minWidth` bật cuộn ngang khi card
              còn hẹp hơn thế, cột nhãn thứ `position: sticky` giữ mốc khi cuộn. */}
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <div style={{ minWidth: 208 }}>
              {/* gap 3 + cột nhãn 24px: đủ chỗ cho nhãn giờ "00–03" ở 10px ngay tại 1280 (ô ~27px),
                  nếu nới gap lên nữa thì nhãn chồng lên nhau. */}
              <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(8, minmax(20px, 1fr))', gap: 3 }}>
                <span style={{ ...cornerCell, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }} />
                {slotLabel.map((s) => (
                  <div key={s} style={{ fontSize: 10, color: '#a59fbb', textAlign: 'center', fontWeight: 700 }}>{s}</div>
                ))}

                {dowLabel.map((label, i) => {
                  const dow = i + 1;
                  return [
                    <div key={`h${dow}`} style={{
                      fontSize: 11, fontWeight: 700, color: '#8a85a0', display: 'flex', alignItems: 'center',
                      position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                    }}>
                      {label}
                    </div>,
                    ...slotLabel.map((_, slot) => {
                      const cell = byKey.get(`${dow}-${slot}`);
                      return (
                        <div
                          key={`${dow}-${slot}`}
                          role="img"
                          aria-label={cellAria(cell, dow, slot)}
                          tabIndex={cell ? 0 : -1}
                          title={cell ? undefined : t.anaHeatNoPost}
                          onMouseEnter={(e) => cell && setHover({ cell, x: e.clientX, y: e.clientY })}
                          onMouseMove={(e) => cell && setHover({ cell, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHover(null)}
                          onFocus={(e) => {
                            if (!cell) return;
                            const r = e.currentTarget.getBoundingClientRect();
                            setHover({ cell, x: r.left + r.width / 2, y: r.bottom });
                          }}
                          onBlur={() => setHover(null)}
                          style={{
                            // 16px cao vẫn bắt được hover/focus (tooltip dùng chung handler) mà 7
                            // hàng chỉ còn ~133px — vừa nửa dưới của cột phải.
                            height: 16, borderRadius: 5,
                            // Ô chưa từng đăng: xám trung tính, KHÁC hẳn ô có bài nhưng tương tác thấp.
                            background: cell ? colorOf(cell) : '#f5f4f8',
                            border: cell?.lowSample ? '1.5px dashed #b9a7ea' : '1px solid transparent',
                            opacity: cell?.lowSample ? 0.7 : 1,
                            cursor: cell ? 'default' : 'default',
                          }}
                        />
                      );
                    }),
                  ];
                })}
              </div>
            </div>
          </div>

          {/* Chú giải gom vào MỘT dòng: thang màu + hai ký hiệu đặc biệt. Font giữ 11.5px (không hạ
              theo ô) — ô nhỏ đi nhưng chữ vẫn phải đọc được. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11.5, color: '#8a85a0' }}>{t.anaHeatLow}</span>
              <span aria-hidden style={{
                width: 56, height: 8, borderRadius: 999,
                background: 'linear-gradient(90deg, rgba(139,92,246,.14), rgba(139,92,246,.9))',
              }} />
              <span style={{ fontSize: 11.5, color: '#8a85a0' }}>{t.anaHeatHigh}</span>
            </div>
            <div style={legendItem}>
              <span aria-hidden style={{ ...legendSwatch, background: '#f5f4f8' }} />
              {t.anaHeatNoPost}
            </div>
            <div style={legendItem} title={t.anaHeatLowSample.replace('{n}', String(minPostsForScale))}>
              <span aria-hidden style={{ ...legendSwatch, background: 'rgba(139,92,246,.45)', border: '1.5px dashed #b9a7ea', opacity: 0.7 }} />
              {t.anaHeatLowSample.replace('{n}', String(minPostsForScale))}
            </div>
          </div>

          {scaledCells === 0 && (
            <div style={{ fontSize: 11.5, color: '#a16207', background: '#fffaf0', border: '1px solid #fce7c3', borderRadius: 10, padding: '8px 10px', marginTop: 10 }}>
              {t.anaHeatNoScale.replace('{n}', String(minPostsForScale))}
            </div>
          )}
        </>
      )}

      {/* Tooltip: LUÔN hiện cả tương tác TB lẫn số bài — thiếu một trong hai là dễ đọc nhầm. */}
      {hover && (
        <div style={{
          position: 'fixed', left: Math.min(hover.x + 12, window.innerWidth - 190), top: hover.y + 14,
          background: '#fff', border: '1px solid #efeaf8', borderRadius: 12, padding: '9px 11px',
          boxShadow: '0 12px 28px -18px rgba(80,40,140,.6)', fontSize: 12.5, zIndex: 60, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, color: '#211c38' }}>
            {dowLabel[hover.cell.dow - 1]} · {slotLabel[hover.cell.slot]}
          </div>
          <div style={{ color: '#5b5670', marginTop: 3 }}>
            {t.anaHeatCellAvg.replace('{v}', formatGroupedNumber(Math.round(hover.cell.avgEngagement), lang))}
          </div>
          <div style={{ color: '#8a85a0' }}>
            {t.anaHeatCellPosts.replace('{n}', String(hover.cell.posts))}
            {hover.cell.lowSample && ` · ${t.anaNotEnoughData}`}
          </div>
        </div>
      )}
    </Card>
  );
}

const cornerCell: CSSProperties = { display: 'block' };

const legendItem: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#8a85a0',
};

const legendSwatch: CSSProperties = { width: 14, height: 10, borderRadius: 4, flex: 'none' };

export default memo(ActivityHeatmap);
