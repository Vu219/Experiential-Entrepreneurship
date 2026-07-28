import { Download, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import DateRangePill from './DateRangePill';
import type { PostProblemKind, PostProblemSummary } from '../../../api/admin';

// Khối B của thiết kế: hàng tab (kèm badge số lượng) bên trái, khoảng ngày + "Bộ lọc" +
// "Xuất báo cáo" bên phải. Badge lấy TỪ SUMMARY của backend — không đếm trên trang đang tải,
// nên số vẫn đúng khi danh sách có nhiều trang. Chưa tải xong thì không hiện badge (không đoán 0).

const TABS: { key: PostProblemKind; labelKey: 'apTabRejected' | 'apTabSystem' }[] = [
  { key: 'rejected', labelKey: 'apTabRejected' },
  { key: 'system', labelKey: 'apTabSystem' },
];

const controlBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px',
  border: '1px solid #ece8f6', borderRadius: 10, background: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
} as const;

export default function PostProblemToolbar({
  kind,
  summary,
  range,
  activeFilters,
  filtersOpen,
  exporting,
  onKindChange,
  onRangeChange,
  onToggleFilters,
  onExport,
}: {
  kind: PostProblemKind;
  /** null khi summary chưa tải xong / lỗi — badge ẩn thay vì hiện số bịa. */
  summary: PostProblemSummary | null;
  range: { from: string; to: string };
  activeFilters: number;
  filtersOpen: boolean;
  exporting: boolean;
  onKindChange: (kind: PostProblemKind) => void;
  onRangeChange: (range: { from: string; to: string }) => void;
  onToggleFilters: () => void;
  onExport: () => void;
}) {
  const { t } = useApp();

  const countOf = (key: PostProblemKind): number | null => {
    if (!summary) return null;
    return key === 'rejected' ? summary.policyViolation.value : summary.technical.value;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(({ key, labelKey }) => {
          const active = kind === key;
          const count = countOf(key);
          return (
            <button
              key={key}
              onClick={() => onKindChange(key)}
              aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                border: `1px solid ${active ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 999, padding: '7px 15px',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: active ? '#f1e9ff' : '#fff', color: active ? '#7c3aed' : '#6b6680',
              }}
            >
              {t[labelKey]}
              {count !== null && (
                <span style={{
                  fontSize: 10.5, fontWeight: 800, minWidth: 20, padding: '1px 6px', borderRadius: 999,
                  background: active ? '#7c3aed' : '#f3f0fa', color: active ? '#fff' : '#8a85a0',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <DateRangePill value={range} onChange={onRangeChange} />

        <button
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
          className="btn-soft"
          style={{ ...controlBtn, color: activeFilters > 0 || filtersOpen ? '#7c3aed' : '#5b5670' }}
        >
          <SlidersHorizontal size={14} strokeWidth={1.8} />
          {t.apFilterBtn}
          {activeFilters > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, minWidth: 18, padding: '1px 5px', borderRadius: 999,
              background: '#f1e9ff', color: '#7c3aed',
            }}>
              {activeFilters}
            </span>
          )}
        </button>

        <button
          onClick={onExport}
          disabled={exporting}
          className="btn-soft"
          style={{ ...controlBtn, color: '#5b5670', cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1 }}
        >
          <Download size={14} strokeWidth={1.8} color="#8b5cf6" />
          {t.apExport}
        </button>
      </div>
    </div>
  );
}
