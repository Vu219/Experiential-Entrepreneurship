import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Calendar, Check, ChevronDown, Download, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import DaySheet from '../calendar/DaySheet';
import DemoBadge from '../dashboard/DemoBadge';
import { PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { TAG_TO_PLATFORM } from '../../api/connections';
import { CONTENT_TYPES, type AnalyticsFilter, type ContentTypeLabel } from '../../api/analytics';
import type { Platform } from '../../api/brandProfile';
import FilterPopover from './FilterPopover';
import RangeCalendar from './RangeCalendar';
import { PRESETS, activePreset, formatRangeLabel, rangeOfPreset, todayISO, type PresetKey } from './dateRange';

/**
 * Hàng công cụ trang Phân tích (v2) — **một nguồn filter duy nhất cho cả trang**: không card nào có
 * dropdown thời gian riêng, các card chỉ hiện `RangeBadge` tĩnh nhắc khoảng đang áp dụng.
 *
 * KHÔNG sticky: bản cũ dính dưới Topbar nhưng nền mờ vẫn để lộ card trượt qua bên dưới, đọc ra như
 * hai lớp chồng nhau. Giờ là một hàng phẳng, cuộn cùng nội dung.
 *
 * Desktop/tablet: nút khoảng ngày (popover preset + lịch range) · nút "Bộ lọc" (popover nền tảng +
 * loại nội dung, badge đếm) · nút "Xuất báo cáo". Mobile: một hàng gọn (nhãn preset rút gọn + phễu
 * + icon xuất), phễu mở **bottom sheet** chứa toàn bộ bộ lọc với footer Áp dụng / Xoá lọc dính đáy —
 * KHÔNG trải chip preset ngang gây tràn màn hình.
 */
export default function AnalyticsFilterBar({
  filter,
  onChange,
  onExportCsv,
  exporting,
  demo,
}: {
  filter: AnalyticsFilter;
  onChange: (patch: Partial<AnalyticsFilter>) => void;
  onExportCsv: () => void;
  exporting: boolean;
  /** Đang hiển thị dữ liệu mẫu → badge mảnh cạnh thanh lọc (không chiếm nguyên hàng như bản cũ). */
  demo: boolean;
}) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const [openPanel, setOpenPanel] = useState<'range' | 'filters' | 'export' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rangeRef = useRef<HTMLButtonElement>(null);
  const filtersRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);

  const preset = activePreset(filter.from, filter.to);
  const activeCount = filter.platforms.length + filter.contentTypes.length;
  const presetLabel: Record<PresetKey, string> = {
    today: t.anaRangeToday, d7: t.anaRange7, d30: t.anaRange30, d90: t.anaRange90, custom: t.anaRangeCustom,
  };
  const rangeLabel = isMobile
    ? (preset === 'custom' ? formatRangeLabel(filter.from, filter.to) : presetLabel[preset])
    : formatRangeLabel(filter.from, filter.to);

  const close = () => setOpenPanel(null);
  const toggle = (panel: 'range' | 'filters' | 'export') => setOpenPanel((v) => (v === panel ? null : panel));

  return (
    <div
      className="ana-filter-bar"
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 44 }}
    >
      {/* Chip gọn cùng hàng với bộ lọc — câu giải thích dài nằm trong tooltip để thanh lọc không
          phình thành một hàng banner riêng. */}
      {demo && (
        <span title={t.anaDemoNote} style={{ display: 'inline-flex', flex: 'none' }}>
          <DemoBadge label={t.dbDemoData} />
        </span>
      )}

      {/* Cụm nút luôn căn phải, kể cả khi không có badge dữ liệu mẫu. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <button
          ref={rangeRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === 'range' || sheetOpen}
          aria-label={t.anaDateRange}
          onClick={() => (isMobile ? setSheetOpen(true) : toggle('range'))}
          style={triggerStyle(openPanel === 'range', isMobile)}
        >
          <Calendar size={15} strokeWidth={1.9} />
          {rangeLabel}
          <ChevronDown size={14} strokeWidth={2} />
        </button>

        <button
          ref={filtersRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openPanel === 'filters' || sheetOpen}
          aria-label={t.anaFilterBtn}
          onClick={() => (isMobile ? setSheetOpen(true) : toggle('filters'))}
          style={triggerStyle(openPanel === 'filters', isMobile)}
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} />
          {!isMobile && t.anaFilterBtn}
          {activeCount > 0 && (
            <span aria-hidden style={{
              minWidth: 18, height: 18, borderRadius: 999, background: '#7c3aed', color: '#fff',
              fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
            }}>
              {activeCount}
            </span>
          )}
        </button>

        <button
          ref={exportRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={openPanel === 'export'}
          aria-label={t.anExport}
          disabled={exporting}
          onClick={() => toggle('export')}
          style={{ ...triggerStyle(openPanel === 'export', isMobile), opacity: exporting ? 0.6 : 1 }}
        >
          <Download size={15} strokeWidth={1.9} />
          {!isMobile && (exporting ? t.anaExporting : t.anExport)}
        </button>
      </div>

      {/* ---- Popover desktop/tablet ---- */}
      {openPanel === 'range' && !isMobile && (
        <FilterPopover anchorRef={rangeRef} onClose={close} width={430} ariaLabel={t.anaDateRange}>
          <RangePanel filter={filter} preset={preset} presetLabel={presetLabel}
            onChange={(from, to) => { onChange({ from, to }); close(); }} />
        </FilterPopover>
      )}

      {openPanel === 'filters' && !isMobile && (
        <FilterPopover anchorRef={filtersRef} onClose={close} width={280} ariaLabel={t.anaFilterBtn}>
          <FiltersPanel filter={filter} onChange={onChange} />
          <button type="button" onClick={() => onChange({ platforms: [], contentTypes: [] })}
            disabled={activeCount === 0} style={{ ...clearBtn, opacity: activeCount === 0 ? 0.5 : 1 }}>
            {t.anaFilterClear}
          </button>
        </FilterPopover>
      )}

      {openPanel === 'export' && (
        <FilterPopover anchorRef={exportRef} onClose={close} width={210} ariaLabel={t.anExport}>
          <button type="button" style={menuItem} onClick={() => { close(); onExportCsv(); }}>{t.anaExportCsv}</button>
          {/* PDF = in trang (dự án đã có CSS @media print) — không thêm thư viện PDF. */}
          <button type="button" style={menuItem} onClick={() => { close(); window.print(); }}>{t.anaExportPdf}</button>
        </FilterPopover>
      )}

      {/* ---- Bottom sheet mobile: toàn bộ bộ lọc trong một sheet, footer dính đáy ---- */}
      {sheetOpen && isMobile && (
        <MobileFilterSheet filter={filter} onClose={() => setSheetOpen(false)} onApply={(next) => { onChange(next); setSheetOpen(false); }} />
      )}
    </div>
  );
}

/** Cột preset + lịch chọn khoảng; ô nhập ngày CHỈ hiện khi đang ở chế độ "Tùy chọn". */
function RangePanel({
  filter, preset, presetLabel, onChange, stacked = false,
}: {
  filter: AnalyticsFilter;
  preset: PresetKey;
  presetLabel: Record<PresetKey, string>;
  onChange: (from: string, to: string) => void;
  /** true = xếp dọc (bottom sheet mobile) thay vì 2 cột. */
  stacked?: boolean;
}) {
  const { t } = useApp();
  const [custom, setCustom] = useState(preset === 'custom');

  return (
    <div style={{ display: stacked ? 'block' : 'grid', gridTemplateColumns: '128px 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: stacked ? 'row' : 'column', flexWrap: 'wrap', gap: 6, marginBottom: stacked ? 12 : 0 }}>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" aria-pressed={!custom && preset === p.key}
            onClick={() => { setCustom(false); const r = rangeOfPreset(p.days); onChange(r.from, r.to); }}
            style={presetBtn(!custom && preset === p.key)}>
            {presetLabel[p.key]}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} style={presetBtn(custom)}>
          {presetLabel.custom}
        </button>
      </div>

      <div>
        {/* Hai ô ngày chỉ xuất hiện ở chế độ Tùy chọn — bản cũ luôn hiện nên trùng chức năng với chip. */}
        {custom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="date" value={filter.from} max={filter.to} aria-label={t.anaFrom} style={dateInput}
              onChange={(e) => e.target.value && onChange(e.target.value, filter.to)} />
            <span style={{ fontSize: 13, color: '#8a85a0' }}>—</span>
            <input type="date" value={filter.to} min={filter.from} max={todayISO()} aria-label={t.anaTo} style={dateInput}
              onChange={(e) => e.target.value && onChange(filter.from, e.target.value)} />
          </div>
        )}
        <RangeCalendar from={filter.from} to={filter.to} onChange={(f, tt) => { setCustom(true); onChange(f, tt); }} />
      </div>
    </div>
  );
}

/** Nền tảng (multi-select) + loại nội dung — trạng thái checked rõ ràng bằng ô tick. */
function FiltersPanel({
  filter, onChange,
}: {
  filter: AnalyticsFilter;
  onChange: (patch: Partial<AnalyticsFilter>) => void;
}) {
  const { t } = useApp();
  const typeLabel: Record<ContentTypeLabel, string> = useMemo(() => ({
    IMAGE: t.dbFmtImage, VIDEO: t.dbFmtVideo, TEXT: t.dbFmtText, OTHER: t.dbFmtOther,
  }), [t]);

  const togglePlatform = (p: Platform) => onChange({
    platforms: filter.platforms.includes(p) ? filter.platforms.filter((x) => x !== p) : [...filter.platforms, p],
  });
  const toggleType = (ty: ContentTypeLabel) => onChange({
    contentTypes: filter.contentTypes.includes(ty) ? filter.contentTypes.filter((x) => x !== ty) : [...filter.contentTypes, ty],
  });

  return (
    <>
      <div style={groupTitle}>{t.anaPlatforms}</div>
      {PLATFORMS.map((pf) => {
        const platform = TAG_TO_PLATFORM[pf.tag];
        const checked = filter.platforms.includes(platform);
        return (
          <button key={pf.tag} type="button" role="checkbox" aria-checked={checked}
            onClick={() => togglePlatform(platform)} style={optionRow}>
            <CheckBox checked={checked} />
            <PlatformTag tag={pf.tag} bg={PLATFORM_BG[pf.tag] ?? '#6b7280'} size={22} radius={6} fontSize={10} />
            <span style={{ flex: 1, textAlign: 'left' }}>{pf.name}</span>
          </button>
        );
      })}

      <div style={{ ...groupTitle, marginTop: 12 }}>{t.anaContentTypes}</div>
      {CONTENT_TYPES.map((ty) => {
        const checked = filter.contentTypes.includes(ty);
        return (
          <button key={ty} type="button" role="checkbox" aria-checked={checked}
            onClick={() => toggleType(ty)} style={optionRow}>
            <CheckBox checked={checked} />
            <span style={{ flex: 1, textAlign: 'left' }}>{typeLabel[ty]}</span>
          </button>
        );
      })}
    </>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden style={{
      width: 18, height: 18, flex: 'none', borderRadius: 6, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      border: checked ? 'none' : '1.5px solid #dcd6ec',
      background: checked ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : '#fff',
    }}>
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
    </span>
  );
}

/** Bottom sheet mobile: chỉnh trên bản NHÁP, chỉ áp dụng khi bấm "Áp dụng" (tránh fetch mỗi lần chạm). */
function MobileFilterSheet({
  filter, onClose, onApply,
}: {
  filter: AnalyticsFilter;
  onClose: () => void;
  onApply: (next: Partial<AnalyticsFilter>) => void;
}) {
  const { t } = useApp();
  const [draft, setDraft] = useState<AnalyticsFilter>(filter);
  const preset = activePreset(draft.from, draft.to);
  const presetLabel: Record<PresetKey, string> = {
    today: t.anaRangeToday, d7: t.anaRange7, d30: t.anaRange30, d90: t.anaRange90, custom: t.anaRangeCustom,
  };

  return (
    <DaySheet
      title={t.anaFilterBtn}
      subtitle={formatRangeLabel(draft.from, draft.to)}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setDraft({ ...draft, platforms: [], contentTypes: [] })}
            style={{ ...sheetBtn, background: '#fff', color: '#6b6680', border: '1px solid #ece8f6' }}>
            {t.anaFilterClear}
          </button>
          <button type="button" onClick={() => onApply(draft)}
            style={{ ...sheetBtn, background: 'linear-gradient(135deg,#8b5cf6,#d946ef)', color: '#fff', border: 'none' }}>
            {t.anaFilterApply}
          </button>
        </div>
      }
    >
      <div style={groupTitle}>{t.anaDateRange}</div>
      <RangePanel stacked filter={draft} preset={preset} presetLabel={presetLabel}
        onChange={(from, to) => setDraft((d) => ({ ...d, from, to }))} />
      <div style={{ height: 14 }} />
      <FiltersPanel filter={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    </DaySheet>
  );
}

// ---- styles ----
const triggerStyle = (open: boolean, isMobile: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 7,
  minHeight: 44, padding: isMobile ? '0 12px' : '0 14px',
  border: '1px solid', borderColor: open ? '#d8c9ff' : '#ece8f6',
  background: open ? '#f6f2ff' : '#fff', color: open ? '#6d28d9' : '#4b4660',
  borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
});

const presetBtn = (active: boolean): CSSProperties => ({
  border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
  background: active ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : '#fff',
  color: active ? '#fff' : '#5b5670',
  borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
});

const optionRow: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
  padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, color: '#3f3a55', cursor: 'pointer',
};

const groupTitle: CSSProperties = {
  fontSize: 11.5, fontWeight: 800, color: '#a59fbb', textTransform: 'uppercase',
  letterSpacing: '.04em', margin: '2px 8px 6px',
};

const clearBtn: CSSProperties = {
  width: '100%', marginTop: 10, minHeight: 40, border: '1px solid #ece8f6', background: '#fff',
  borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#e23d6e', cursor: 'pointer',
};

const menuItem: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px',
  border: 'none', background: 'transparent', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, color: '#3f3a55', cursor: 'pointer', textAlign: 'left',
};

const dateInput: CSSProperties = {
  flex: 1, minWidth: 0, border: '1px solid #e7e2f2', borderRadius: 10, padding: '8px 10px',
  fontSize: 13, color: '#241f3a', background: '#fbfaff',
};

const sheetBtn: CSSProperties = {
  flex: 1, minHeight: 46, borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
};
