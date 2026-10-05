import { memo, useState, type ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight, Pin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon, PlatformTag } from '../ui';
import Pagination from '../admin/Pagination';
import { PLATFORM_BG } from '../../theme';
import { FIT_COLORS, type TrendItem } from '../../trendsData';
import { Pill } from './filters';
import { C } from '../../styles/colors';

/** Tỷ lệ cột (table-layout: fixed) — co giãn cột mô tả, giữ cột số liệu gọn. */
const COL_WIDTHS = ['32%', '10%', '11%', '17%', '14%', '16%'];

/** Mini sparkline cho cột "Xu hướng". */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 52;
  const h = 22;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden style={{ flex: 'none' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GrowthTag({ trend }: { trend: TrendItem }) {
  const color = trend.up ? '#16a34a' : '#dc2626';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12.5, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
      <Icon icon={trend.up ? ArrowUpRight : ArrowDownRight} size={14} stroke={color} />
      {trend.growth}
    </span>
  );
}

/** Nút ghim/bỏ ghim một trend — ghim thì icon tô đặc màu brand. */
function PinButton({ pinned, onClick, label }: { pinned: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', borderRadius: 8, background: pinned ? C.primarySoft : 'transparent', cursor: 'pointer', flex: 'none' }}
    >
      <Pin size={14} color={pinned ? C.primary : C.ink350} fill={pinned ? C.primary : 'none'} strokeWidth={1.9} />
    </button>
  );
}

/** Checkbox chọn trend để xóa (chỉ hiện ở chế độ chọn). */
function SelectBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 16, height: 16, flex: 'none', accentColor: '#8b5cf6', cursor: 'pointer' }}
    />
  );
}

function ViewIdeasLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link-underline"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '2px 0', fontSize: 12.5, fontWeight: 600, color: C.primary, cursor: 'pointer' }}
    >
      {label}
      <Icon icon={ChevronRight} size={13} stroke={C.primary} />
    </button>
  );
}

/**
 * Danh sách trend nổi bật: dạng bảng (≥1024px) hoặc card dọc (tablet/mobile),
 * dùng chung data + phân trang, chỉ đổi phần render.
 * memo: chỉ render lại khi rows/onViewIdeas đổi (gõ ô tìm kiếm không dội vào bảng
 * chừng nào kết quả lọc chưa đổi — rows và callback đều được page memo hóa).
 */
export default memo(function TrendTable({
  rows,
  pinnedIds,
  selectMode,
  selectedIds,
  onViewIdeas,
  onTogglePin,
  onToggleSelect,
}: {
  rows: TrendItem[];
  /** Trend đã ghim (luôn nổi lên đầu — page sắp sẵn thứ tự). */
  pinnedIds: Set<string>;
  /** Chế độ chọn nhiều trend để xóa: hiện checkbox mỗi dòng. */
  selectMode: boolean;
  selectedIds: Set<string>;
  onViewIdeas: (trendId: string) => void;
  onTogglePin: (trendId: string) => void;
  onToggleSelect: (trendId: string) => void;
}) {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const asCards = width < 1024;
  // PC ≥1280: 10 · Laptop 1024–1279: 8 · Tablet 760–1023: 6 (card) · Mobile <760: 5 (card)
  const pageSize = width >= 1280 ? 10 : width >= 1024 ? 8 : width >= 760 ? 6 : 5;

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount); // filter đổi làm giảm số trang → kẹp lại, không cần reset thủ công
  const start = (safePage - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  const fitLabel = { high: t.trFitHigh, medium: t.trFitMed, low: t.trFitLow } as const;

  const footer: ReactNode = rows.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: asCards ? 0 : '0 16px 14px' }}>
      <span style={{ fontSize: 12.5, color: C.textMuted, marginTop: 16 }}>
        {t.trShowing} {start + 1}–{start + visible.length}/{rows.length} {t.trTrendUnit}
      </span>
      <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
    </div>
  );

  // ===== Dạng card dọc (tablet & mobile) =====
  if (asCards) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map((tr) => (
          <Card key={tr.id} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, ...(selectMode && selectedIds.has(tr.id) ? { outline: `1.5px solid ${C.violetLight}` } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {selectMode && (
                <span style={{ display: 'flex', alignItems: 'center', height: 40 }}>
                  <SelectBox checked={selectedIds.has(tr.id)} onChange={() => onToggleSelect(tr.id)} />
                </span>
              )}
              <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: tr.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{tr.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink750 }}>
                  {pinnedIds.has(tr.id) && <Pin size={12} color={C.primary} fill={C.primary} style={{ marginRight: 4, verticalAlign: -1 }} />}
                  {tr.name} <span style={{ fontWeight: 600, color: C.primary }}>{tr.hashtag}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr.desc}</div>
              </div>
              <Pill text={fitLabel[tr.fit]} color={FIT_COLORS[tr.fit].color} bg={FIT_COLORS[tr.fit].bg} style={{ flex: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 5 }}>
                {tr.platforms.map((tag) => (
                  <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={7} fontSize={10} />
                ))}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkline points={tr.spark} color={tr.up ? C.success : C.danger} />
                <GrowthTag trend={tr} />
              </span>
              <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 700, color: C.ink750 }}>{tr.engagement}</span>{' '}
                <span style={{ fontWeight: 700, color: tr.engagementDelta.startsWith('-') ? C.danger : C.success }}>{tr.engagementDelta}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink750 }}>{tr.ideaCount} {t.trIdeaUnit}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PinButton pinned={pinnedIds.has(tr.id)} onClick={() => onTogglePin(tr.id)} label={pinnedIds.has(tr.id) ? t.trUnpin : t.trPin} />
                <ViewIdeasLink onClick={() => onViewIdeas(tr.id)} label={t.trViewIdeas} />
              </span>
            </div>
          </Card>
        ))}
        {visible.length === 0 && (
          <Card>
            <div style={{ padding: '14px 0', fontSize: 13.5, color: C.textMuted, textAlign: 'center' }}>{t.trNoResult}</div>
          </Card>
        )}
        {footer}
      </div>
    );
  }

  // ===== Dạng bảng (≥1024px) — table-layout fixed, không tràn ngang =====
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {COL_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            {[t.trColTopic, t.trColPlatform, t.trColFit, t.trColTrend, t.trColEngage, t.trColIdeas].map((h, i) => (
              <th key={i} scope="col" style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, padding: '13px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: `1px solid ${C.surfaceMuted}`, ...(i === 0 ? { paddingLeft: 16 } : {}) }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((tr) => {
            const trendColor = tr.up ? '#16a34a' : '#dc2626';
            return (
              <tr key={tr.id} style={{ borderTop: `1px solid ${C.surfaceMuted}`, background: selectMode && selectedIds.has(tr.id) ? C.bg : 'transparent' }}>
                <td style={{ padding: '12px 8px 12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selectMode && <SelectBox checked={selectedIds.has(tr.id)} onChange={() => onToggleSelect(tr.id)} />}
                    <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, background: tr.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{tr.emoji}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pinnedIds.has(tr.id) && <Pin size={12} color={C.primary} fill={C.primary} style={{ marginRight: 4, verticalAlign: -1 }} />}
                        {tr.name} <span style={{ fontWeight: 600, color: C.primary }}>{tr.hashtag}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.desc}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {tr.platforms.map((tag) => (
                      <PlatformTag key={tag} tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={7} fontSize={10} />
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <Pill text={fitLabel[tr.fit]} color={FIT_COLORS[tr.fit].color} bg={FIT_COLORS[tr.fit].bg} style={{ padding: '3px 9px' }} />
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <Sparkline points={tr.spark} color={trendColor} />
                    <GrowthTag trend={tr} />
                  </div>
                </td>
                <td style={{ padding: '12px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink750 }}>{tr.engagement}</span>{' '}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: tr.engagementDelta.startsWith('-') ? C.danger : C.success }}>{tr.engagementDelta}</span>
                </td>
                <td style={{ padding: '12px 8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink750, whiteSpace: 'nowrap' }}>{tr.ideaCount} {t.trIdeaUnit}</span>
                    <ViewIdeasLink onClick={() => onViewIdeas(tr.id)} label={t.trViewIdeas} />
                    <PinButton pinned={pinnedIds.has(tr.id)} onClick={() => onTogglePin(tr.id)} label={pinnedIds.has(tr.id) ? t.trUnpin : t.trPin} />
                  </div>
                </td>
              </tr>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '28px 16px', fontSize: 13.5, color: C.textMuted, textAlign: 'center' }}>{t.trNoResult}</td>
            </tr>
          )}
        </tbody>
      </table>
      {footer}
    </Card>
  );
});
