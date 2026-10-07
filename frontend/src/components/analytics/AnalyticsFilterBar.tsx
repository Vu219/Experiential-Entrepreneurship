import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Calendar, Check, ChevronDown, Download, SlidersHorizontal, X } from 'lucide-react';
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
import {
  PRESETS, activePreset, formatDateInput, formatRangeLabel, parseDateInput, rangeOfPreset, todayISO, type PresetKey,
} from './dateRange';
import { C } from '../../styles/colors';

/**
 * Hàng công cụ trang Phân tích (v2) — **một nguồn filter duy nhất cho cả trang**: không card nào có
 * dropdown thời gian riêng, các card chỉ hiện `RangeBadge` tĩnh nhắc khoảng đang áp dụng.
 *
 * KHÔNG sticky: bản cũ dính dưới Topbar nhưng nền mờ vẫn để lộ card trượt qua bên dưới, đọc ra như
 * hai lớp chồng nhau. Giờ là một hàng phẳng, cuộn cùng nội dung.
 *
 * Desktop/tablet: nút khoảng ngày (popover preset + lịch range) · nút "Bộ lọc" (popover nền tảng +
 * loại nội dung + nguồn bài "Chỉ bài AIMA", badge đếm) · nút "Xuất báo cáo". Mobile: một hàng gọn (nhãn preset rút gọn + phễu
 * + icon xuất), phễu mở **bottom sheet** chứa toàn bộ bộ lọc với footer Áp dụng / Xoá lọc dính đáy —
 * KHÔNG trải chip preset ngang gây tràn màn hình.
 */
/** Phần bộ lọc "chọn nhiều" của thanh công cụ — tách khỏi khoảng ngày vì chỉ các mục này
 *  đi qua bản nháp + nút "Áp dụng"; khoảng ngày vẫn áp dụng ngay khi chọn. */
type FilterSelection = Pick<AnalyticsFilter, 'platforms' | 'contentTypes' | 'aimaOnly'>;

const EMPTY_SELECTION: FilterSelection = { platforms: [], contentTypes: [], aimaOnly: false };
const selectionOf = (f: FilterSelection): FilterSelection =>
  ({ platforms: f.platforms, contentTypes: f.contentTypes, aimaOnly: f.aimaOnly });
const countOf = (f: FilterSelection) => f.platforms.length + f.contentTypes.length + (f.aimaOnly ? 1 : 0);

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
  const { isMobile, isTablet } = useBreakpoint();
  const [openPanel, setOpenPanel] = useState<'range' | 'filters' | 'export' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bản NHÁP của popover lọc: tick/bỏ tick chỉ đổi nháp, phải bấm "Áp dụng" mới gọi lại API —
  // trước đây mỗi lần chạm là một lượt fetch, chọn 3 mục là 3 lần tải lại cả trang.
  const [draft, setDraft] = useState<FilterSelection>(selectionOf(filter));
  const rangeRef = useRef<HTMLButtonElement>(null);
  const filtersRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);

  const preset = activePreset(filter.from, filter.to);
  const activeCount = countOf(filter);
  const draftCount = countOf(draft);
  const typeLabel = useTypeLabel();
  const presetLabel: Record<PresetKey, string> = {
    today: t.anaRangeToday, d7: t.anaRange7, d30: t.anaRange30, d90: t.anaRange90, custom: t.anaRangeCustom,
  };
  const rangeLabel = isMobile
    ? (preset === 'custom' ? formatRangeLabel(filter.from, filter.to) : presetLabel[preset])
    : formatRangeLabel(filter.from, filter.to);

  const close = () => setOpenPanel(null);
  const toggle = (panel: 'range' | 'filters' | 'export') => setOpenPanel((v) => (v === panel ? null : panel));

  // Mở popover lọc = chép bộ lọc ĐANG áp dụng sang nháp (đóng giữa chừng thì bỏ, không âm thầm giữ).
  const openFilters = () => {
    if (isMobile) { setSheetOpen(true); return; }
    if (openPanel === 'filters') { close(); return; }
    setDraft(selectionOf(filter));
    setOpenPanel('filters');
  };

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
        {/* Chip các bộ lọc ĐANG áp dụng — cùng hàng, ngay bên trái nút khoảng ngày. Mỗi chip
            có nút × để bỏ nhanh đúng mục đó, không phải mở lại popover. */}
        {filter.platforms.map((p) => {
          const pf = PLATFORMS.find((x) => TAG_TO_PLATFORM[x.tag] === p);
          return (
            <ActiveChip key={p} onRemove={() => onChange({ platforms: filter.platforms.filter((x) => x !== p) })} label={pf?.name ?? p}>
              {pf && <PlatformTag tag={pf.tag} bg={PLATFORM_BG[pf.tag] ?? '#6b7280'} size={16} radius={5} fontSize={9} />}
            </ActiveChip>
          );
        })}
        {filter.contentTypes.map((ty) => (
          <ActiveChip key={ty} onRemove={() => onChange({ contentTypes: filter.contentTypes.filter((x) => x !== ty) })} label={typeLabel[ty]} />
        ))}
        {filter.aimaOnly && <ActiveChip onRemove={() => onChange({ aimaOnly: false })} label={t.anaAimaOnlyChip} />}

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
          onClick={openFilters}
          style={{ ...triggerStyle(openPanel === 'filters', isMobile), position: 'relative' }}
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} />
          {!isMobile && t.anaFilterBtn}
          {/* Số bộ lọc đang áp dụng — huy hiệu ở GÓC TRÁI TRÊN nút, không chen trong nhãn nên
              bề rộng nút không nhảy mỗi lần đổi bộ lọc. */}
          {activeCount > 0 && (
            <span aria-hidden style={{
              position: 'absolute', top: -7, left: -7,
              minWidth: 19, height: 19, borderRadius: 999, background: '#7c3aed', color: '#fff',
              fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px', border: `2px solid ${C.shell}`,
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
        // Desktop: preset trái + lịch phải; tablet: preset thành hàng chip trên lịch, panel hẹp hơn.
        <FilterPopover anchorRef={rangeRef} onClose={close} width={isTablet ? 360 : 480} ariaLabel={t.anaDateRange}>
          <RangePanel stacked={isTablet} withConfirm filter={filter} preset={preset} presetLabel={presetLabel}
            onChange={(from, to) => { onChange({ from, to }); close(); }} />
        </FilterPopover>
      )}

      {openPanel === 'filters' && !isMobile && (
        <FilterPopover anchorRef={filtersRef} onClose={close} width={280} ariaLabel={t.anaFilterBtn}>
          <FiltersPanel filter={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          {/* Xoá lọc chỉ dọn bản NHÁP — mọi thay đổi chỉ có hiệu lực khi bấm "Áp dụng"
              (cùng quy ước với bottom sheet mobile). */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => setDraft(EMPTY_SELECTION)}
              disabled={draftCount === 0} style={{ ...clearBtn, opacity: draftCount === 0 ? 0.5 : 1 }}>
              {t.anaFilterClear}
            </button>
            <button type="button" onClick={() => { onChange(draft); close(); }} style={applyBtn}>
              {t.anaFilterApply}
            </button>
          </div>
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

/**
 * Cột preset + lịch chọn khoảng; ô nhập ngày CHỈ hiện khi đang ở chế độ "Tùy chọn".
 * Lịch và hai ô ngày cùng sửa một bản NHÁP (bấm ngày đầu → ô "Từ ngày" đổi ngay, "Đến ngày" trống
 * chờ lần bấm thứ hai). Preset áp dụng ngay; khoảng tuỳ chọn chỉ áp dụng khi bấm "Xác nhận"
 * (`withConfirm`, popover desktop/tablet) — trong bottom sheet thì đẩy thẳng vào nháp của sheet,
 * nút "Áp dụng" ở footer sheet mới gọi API.
 */
function RangePanel({
  filter, preset, presetLabel, onChange, stacked = false, withConfirm = false,
}: {
  filter: AnalyticsFilter;
  preset: PresetKey;
  presetLabel: Record<PresetKey, string>;
  onChange: (from: string, to: string) => void;
  /** true = preset thành hàng chip phía trên lịch (tablet + bottom sheet mobile) thay vì 2 cột. */
  stacked?: boolean;
  /** true = khoảng tuỳ chọn chờ nút "Xác nhận" mới gọi `onChange`. */
  withConfirm?: boolean;
}) {
  const { t } = useApp();
  const [custom, setCustom] = useState(preset === 'custom');
  // `to` rỗng = mới chọn ngày bắt đầu, đang chờ ngày kết thúc.
  const [draft, setDraft] = useState({ from: filter.from, to: filter.to });
  useEffect(() => setDraft({ from: filter.from, to: filter.to }), [filter.from, filter.to]);

  const edit = (from: string, to: string) => {
    setCustom(true);
    setDraft({ from, to });
    if (!withConfirm && to) onChange(from, to);
  };
  const dirty = draft.from !== filter.from || draft.to !== filter.to;

  return (
    <div style={{ display: stacked ? 'block' : 'grid', gridTemplateColumns: '128px minmax(0, 1fr)', gap: 14 }}>
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
            <DateField value={draft.from} max={draft.to || todayISO()} label={t.anaFrom}
              onCommit={(iso) => edit(iso, draft.to)} />
            <span style={{ fontSize: 13, color: C.textMuted }}>—</span>
            <DateField value={draft.to} min={draft.from} max={todayISO()} label={t.anaTo}
              onCommit={(iso) => edit(draft.from, iso)} />
          </div>
        )}
        <RangeCalendar from={draft.from} to={draft.to} onChange={edit} />
        {withConfirm && custom && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" disabled={!draft.to || !dirty} onClick={() => onChange(draft.from, draft.to)}
              style={{ ...applyBtn, flex: 'none', padding: '0 18px', opacity: !draft.to || !dirty ? 0.5 : 1,
                cursor: !draft.to || !dirty ? 'default' : 'pointer' }}>
              {t.anaRangeConfirm}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ô nhập một ngày, hiển thị theo ngôn ngữ đang chọn (vi dd/MM/yyyy, en MM/dd/yyyy) — `input type="date"`
 * gốc luôn theo locale trình duyệt và có bề rộng tối thiểu lớn (từng làm tràn popover). Gõ tự do,
 * chốt khi Enter/blur; sai định dạng hoặc ngoài [min, max] thì trả về giá trị cũ.
 */
function DateField({
  value, min, max, label, onCommit,
}: {
  value: string;
  min?: string;
  max?: string;
  label: string;
  onCommit: (iso: string) => void;
}) {
  const { lang } = useApp();
  const show = (iso: string) => (iso ? formatDateInput(iso, lang) : '');
  const [text, setText] = useState(() => show(value));
  useEffect(() => setText(value ? formatDateInput(value, lang) : ''), [value, lang]);

  const commit = () => {
    const iso = parseDateInput(text, lang);
    if (!iso || (min && iso < min) || (max && iso > max)) { setText(show(value)); return; }
    if (iso !== value) onCommit(iso);
  };

  // <label> bọc ngoài: bấm vào icon lịch cũng focus ô nhập.
  return (
    <label style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
      <input type="text" inputMode="numeric" value={text} aria-label={label} title={label}
        placeholder={lang === 'en' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'} style={dateInput}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      <Calendar size={15} strokeWidth={1.9} color={C.textMuted} aria-hidden
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </label>
  );
}

/** Nhãn loại nội dung — dùng chung cho panel lọc và chip "đang áp dụng". */
function useTypeLabel(): Record<ContentTypeLabel, string> {
  const { t } = useApp();
  return useMemo(() => ({
    IMAGE: t.dbFmtImage, VIDEO: t.dbFmtVideo, TEXT: t.dbFmtText, OTHER: t.dbFmtOther,
  }), [t]);
}

/** Một bộ lọc đang áp dụng, có nút × bỏ nhanh ngay trên thanh công cụ. */
function ActiveChip({ label, onRemove, children }: { label: string; onRemove: () => void; children?: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 6px 0 8px',
      border: `1px solid ${C.legacyBordere4dbfa}`, background: C.surfaceMuted, borderRadius: 999,
      fontSize: 12.5, fontWeight: 700, color: C.legacyText5b21b6, whiteSpace: 'nowrap',
    }}>
      {children}
      {label}
      <button type="button" onClick={onRemove} aria-label={`${label} ✕`} title={label}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
          width: 18, height: 18, border: 'none', borderRadius: 999, background: 'transparent',
          color: C.primary, cursor: 'pointer', padding: 0,
        }}>
        <X size={13} strokeWidth={2.4} />
      </button>
    </span>
  );
}

/** Nền tảng (multi-select) + loại nội dung — trạng thái checked rõ ràng bằng ô tick. */
function FiltersPanel({
  filter, onChange,
}: {
  filter: FilterSelection;
  onChange: (patch: Partial<FilterSelection>) => void;
}) {
  const { t } = useApp();
  const typeLabel = useTypeLabel();

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

      {/* Nguồn bài (giai đoạn 2): mặc định cả bài tự đăng ngoài AIMA; tick để chỉ xem bài đăng qua AIMA. */}
      <div style={{ ...groupTitle, marginTop: 12 }}>{t.anaSource}</div>
      <button type="button" role="checkbox" aria-checked={filter.aimaOnly} title={t.anaSourceHint}
        onClick={() => onChange({ aimaOnly: !filter.aimaOnly })} style={optionRow}>
        <CheckBox checked={filter.aimaOnly} />
        <span style={{ flex: 1, textAlign: 'left' }}>{t.anaAimaOnly}</span>
      </button>
      <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.45, margin: '0 8px 2px' }}>{t.anaSourceHint}</div>
    </>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden style={{
      width: 18, height: 18, flex: 'none', borderRadius: 6, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      border: checked ? 'none' : `1.5px solid ${C.legacyBorderdcd6ec}`,
      background: checked ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : C.surface,
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
          <button type="button" onClick={() => setDraft({ ...draft, ...EMPTY_SELECTION })}
            style={{ ...sheetBtn, background: C.surface, color: C.textSecondary, border: `1px solid ${C.border}` }}>
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
  border: '1px solid', borderColor: open ? C.legacyBorderd8c9ff : C.border,
  background: open ? C.surfaceMuted : C.surface, color: open ? C.primaryStrong : C.ink650,
  borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
});

const presetBtn = (active: boolean): CSSProperties => ({
  border: '1px solid', borderColor: active ? 'transparent' : C.border,
  background: active ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : C.surface,
  color: active ? '#fff' : C.ink550,
  borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
});

const optionRow: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
  padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, color: C.text, cursor: 'pointer',
};

const groupTitle: CSSProperties = {
  fontSize: 11.5, fontWeight: 800, color: C.textFaint, textTransform: 'uppercase',
  letterSpacing: '.04em', margin: '2px 8px 6px',
};

const clearBtn: CSSProperties = {
  flex: 1, minHeight: 40, border: `1px solid ${C.border}`, background: C.surface,
  borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.rose, cursor: 'pointer',
};

const applyBtn: CSSProperties = {
  flex: 1, minHeight: 40, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#d946ef)',
  borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
};

const menuItem: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px',
  border: 'none', background: 'transparent', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, color: C.text, cursor: 'pointer', textAlign: 'left',
};

const dateInput: CSSProperties = {
  flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 32px 8px 10px',
  fontSize: 13, color: C.textStrong, background: C.surfaceSubtle,
};

const sheetBtn: CSSProperties = {
  flex: 1, minHeight: 46, borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
};
