import { useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { usePlanUsage } from '../../hooks/usePlanUsage';
import { earliestAnalyticsDate } from '../../utils/planGates';
import DaySheet from '../calendar/DaySheet';
import FilterPopover from '../analytics/FilterPopover';
import RangeCalendar from '../analytics/RangeCalendar';
import { DateField, presetBtn } from '../analytics/AnalyticsFilterBar';
import { formatRangeLabel, rangeOfPreset, todayISO } from '../analytics/dateRange';
import { C } from '../../styles/colors';

/** Bộ lọc khoảng ngày của biểu đồ "Hiệu quả nội dung". */
export type PerfPreset = 'd7' | 'd30' | 'custom';
export interface PerfFilter {
  preset: PerfPreset;
  from: string;
  to: string;
}

export const DEFAULT_PERF_FILTER: PerfFilter = { preset: 'd7', ...rangeOfPreset(7) };

const PRESET_DAYS: Record<Exclude<PerfPreset, 'custom'>, number> = { d7: 7, d30: 30 };

/** Nhãn khoảng đang áp dụng: "7 ngày" / "30 ngày" / "13/07/2026 - 19/07/2026". */
export function usePerfFilterLabel(filter: PerfFilter): string {
  const { t, lang } = useApp();
  if (filter.preset === 'd7') return t.dbRange7;
  if (filter.preset === 'd30') return t.dbRange30;
  return formatRangeLabel(filter.from, filter.to, lang);
}

/**
 * Nút "Bộ lọc" của biểu đồ: gộp 7 ngày / 30 ngày / Tùy chỉnh (lịch chọn khoảng). Mọi lựa chọn chỉ sửa bản NHÁP —
 * biểu đồ chỉ lọc lại khi bấm "Lọc". Desktop/tablet mở popover, mobile mở bottom sheet (cùng mẫu thanh lọc
 * trang Phân tích, tái dùng lịch + ô nhập ngày của nó).
 */
export default function PerformanceFilter({ value, onApply }: { value: PerfFilter; onApply: (next: PerfFilter) => void }) {
  const { t, lang } = useApp();
  const { isMobile } = useBreakpoint();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PerfFilter>(value);

  const toggle = () => {
    if (!open) setDraft(value); // mở lại luôn bắt đầu từ khoảng đang áp dụng, bỏ nháp cũ chưa lọc
    setOpen((o) => !o);
  };
  const apply = () => { onApply(draft); setOpen(false); };

  const body = <PanelBody draft={draft} onChange={setDraft} />;
  // `to` rỗng = mới chọn ngày bắt đầu trên lịch, chưa đủ khoảng để lọc.
  const canApply = !!draft.to;
  const footer = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => setDraft(DEFAULT_PERF_FILTER)} style={resetBtn}>{t.dbFilterReset}</button>
      <button type="button" onClick={apply} disabled={!canApply}
        style={{ ...applyBtn, opacity: canApply ? 1 : 0.5, cursor: canApply ? 'pointer' : 'default' }}>
        {t.dbFilterApply}
      </button>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 12px',
          border: '1px solid', borderColor: open ? C.legacyBorderd8c9ff : C.border,
          background: open ? C.surfaceMuted : C.surface, color: open ? C.primaryStrong : C.ink650,
          borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <SlidersHorizontal size={15} strokeWidth={1.9} />
        {t.anaFilterBtn}
        <ChevronDown size={14} strokeWidth={2} />
      </button>

      {open && !isMobile && (
        <FilterPopover anchorRef={triggerRef} onClose={() => setOpen(false)} width={draft.preset === 'custom' ? 340 : 260}
          ariaLabel={t.anaFilterBtn}>
          {body}
          <div style={{ marginTop: 14 }}>{footer}</div>
        </FilterPopover>
      )}
      {open && isMobile && (
        <DaySheet title={t.anaFilterBtn}
          subtitle={draft.to ? formatRangeLabel(draft.from, draft.to, lang) : undefined}
          onClose={() => setOpen(false)} footer={footer}>
          {body}
        </DaySheet>
      )}
    </>
  );
}

function PanelBody({ draft, onChange }: { draft: PerfFilter; onChange: (next: PerfFilter) => void }) {
  const { t } = useApp();
  // Gói (ANALYTICS_HISTORY_DAYS): ngày sớm nhất được chọn — cùng mốc backend kẹp.
  const { cap } = usePlanUsage();
  const minDate = earliestAnalyticsDate(cap('ANALYTICS_HISTORY_DAYS'), todayISO()) ?? undefined;
  const editRange = (from: string, to: string) => onChange({ preset: 'custom', from, to });

  return (
    <div>
      <div style={groupTitle}>{t.anaDateRange}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(PRESET_DAYS) as Exclude<PerfPreset, 'custom'>[]).map((key) => {
          const r = rangeOfPreset(PRESET_DAYS[key]);
          const beyondPlan = !!minDate && r.from < minDate;
          return (
            <button key={key} type="button" aria-pressed={draft.preset === key} disabled={beyondPlan}
              title={beyondPlan ? t.plgHistoryCap.replace('{date}', minDate!) : undefined}
              onClick={() => onChange({ preset: key, ...r })}
              style={{ ...presetBtn(draft.preset === key), ...(beyondPlan ? { opacity: 0.45, cursor: 'not-allowed' } : null) }}>
              {key === 'd7' ? t.dbRange7 : t.dbRange30}
            </button>
          );
        })}
        <button type="button" aria-pressed={draft.preset === 'custom'}
          onClick={() => onChange({ ...draft, preset: 'custom' })} style={presetBtn(draft.preset === 'custom')}>
          {t.dbRangeCustom}
        </button>
      </div>

      {draft.preset === 'custom' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <DateField value={draft.from} min={minDate} max={draft.to || todayISO()} label={t.anaFrom}
              onCommit={(iso) => editRange(iso, draft.to)} />
            <span style={{ fontSize: 13, color: C.textMuted }}>—</span>
            <DateField value={draft.to} min={draft.from || minDate} max={todayISO()} label={t.anaTo}
              onCommit={(iso) => editRange(draft.from, iso)} />
          </div>
          <RangeCalendar from={draft.from} to={draft.to} min={minDate} onChange={editRange} />
          {minDate && (
            <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>{t.plgHistoryCap.replace('{date}', minDate)}</div>
          )}
        </div>
      )}
    </div>
  );
}

const groupTitle: CSSProperties = {
  fontSize: 11.5, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase',
  letterSpacing: '.04em', margin: '2px 0 8px',
};

const resetBtn: CSSProperties = {
  flex: 1, minHeight: 40, border: `1px solid ${C.border}`, background: C.surface,
  borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.textSecondary, cursor: 'pointer',
};

const applyBtn: CSSProperties = {
  flex: 1, minHeight: 40, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#d946ef)',
  borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff',
};
